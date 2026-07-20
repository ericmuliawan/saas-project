import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication<App>;
  let userAToken: string;
  let userBToken: string;
  let projectAId: string;
  let taskAId: string;

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  beforeAll(async () => {
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.companyMember.deleteMany();
    await prisma.company.deleteMany();
    await prisma.appUser.deleteMany({ where: { email: { contains: 'iso-' } } });

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const ts = Date.now();

    const userA = await prisma.appUser.create({
      data: {
        email: `iso-a-${ts}@test.com`,
        fullName: 'Tenant A User',
        passwordHash,
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date('2027-12-31'),
      },
    });

    const userB = await prisma.appUser.create({
      data: {
        email: `iso-b-${ts}@test.com`,
        fullName: 'Tenant B User',
        passwordHash,
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date('2027-12-31'),
      },
    });

    const companyA = await prisma.company.create({
      data: { name: 'Company A', slug: `company-a-${ts}`, ownerId: userA.id },
    });

    const companyB = await prisma.company.create({
      data: { name: 'Company B', slug: `company-b-${ts}`, ownerId: userB.id },
    });

    await prisma.appUser.update({ where: { id: userA.id }, data: { activeCompanyId: companyA.id } });
    await prisma.appUser.update({ where: { id: userB.id }, data: { activeCompanyId: companyB.id } });

    const project = await prisma.project.create({
      data: { companyId: companyA.id, name: 'Secret Project A', createdById: userA.id },
    });
    projectAId = project.id;

    const task = await prisma.task.create({
      data: { companyId: companyA.id, projectId: project.id, title: 'Secret Task A' },
    });
    taskAId = task.id;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const loginARes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: PASSWORD });
    userAToken = (loginARes.body as AuthResponse).accessToken;

    const loginBRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userB.email, password: PASSWORD });
    userBToken = (loginBRes.body as AuthResponse).accessToken;
  }, TIMEOUT);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  }, TIMEOUT);

  it('user B cannot read user A project (cross-tenant)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('user B cannot update user A project (cross-tenant)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ name: 'Hacked' });
    expect([403, 404]).toContain(res.status);
  });

  it('user B cannot read user A task (cross-tenant)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectAId}/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('user B cannot update user A task (cross-tenant)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectAId}/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ status: 'done' });
    expect([403, 404]).toContain(res.status);
  });

  it('user B cannot delete user A task (cross-tenant)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectAId}/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('user B project list does not contain user A projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    const projects = (body.data as Array<{ id: string }>) ?? [];
    expect(projects.some((p) => p.id === projectAId)).toBe(false);
  });
});
