import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';

const PASSWORD = 'ValidPass1234';
const TIMEOUT = 30_000;

interface AuthResponse {
  accessToken: string;
}

describe('Input Validation (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  beforeAll(async () => {
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.companyMember.deleteMany();
    await prisma.company.deleteMany();
    await prisma.appUser.deleteMany({ where: { email: { contains: 'validation-' } } });

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const ts = Date.now();

    const owner = await prisma.appUser.create({
      data: {
        email: `validation-owner-${ts}@test.com`,
        fullName: 'Validation Owner',
        passwordHash,
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date('2027-12-31'),
      },
    });

    const company = await prisma.company.create({
      data: { name: 'Validation Company', slug: `validation-company-${ts}`, ownerId: owner.id },
    });

    await prisma.appUser.update({ where: { id: owner.id }, data: { activeCompanyId: company.id } });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: PASSWORD });
    ownerToken = (loginRes.body as AuthResponse).accessToken;
  }, TIMEOUT);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  }, TIMEOUT);

  it('rejects project creation with missing name (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'No name provided' });

    expect(res.status).toBe(400);
  });

  it('rejects project creation with empty name (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  it('rejects task creation with missing title (400)', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Validation Project' })
      .expect(201);

    const projectBody = projectRes.body as { data: { id: string } };

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectBody.data.id}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(400);
  });

  it('rejects task creation with invalid priority (400)', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Validation Project 2' })
      .expect(201);

    const projectBody = projectRes.body as { data: { id: string } };

    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectBody.data.id}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Test', priority: 'urgent' });

    expect(res.status).toBe(400);
  });

  it('rejects add member with invalid role (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'test@test.com', role: 'superadmin' });

    expect(res.status).toBe(400);
  });

  it('rejects register with weak password (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Weak Password User',
        email: `weak-${Date.now()}@test.com`,
        password: 'weak',
      });

    expect(res.status).toBe(400);
  });

  it('rejects request without auth token (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/projects');

    expect(res.status).toBe(401);
  });

  it('accepts valid project creation (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Valid Project', description: 'This is valid' })
      .expect(201);

    const body = res.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    const data = body.data as { name: string };
    expect(data.name).toBe('Valid Project');
  });
});
