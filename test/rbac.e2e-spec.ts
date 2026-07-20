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

interface ListResponse {
  success: boolean;
  data: unknown[];
}

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let memberToken: string;
  let projectId: string;
  let taskId: string;

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  beforeAll(async () => {
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.companyMember.deleteMany();
    await prisma.company.deleteMany();
    await prisma.appUser.deleteMany({ where: { email: { contains: 'rbac-' } } });

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const ts = Date.now();

    const owner = await prisma.appUser.create({
      data: {
        email: `rbac-owner-${ts}@test.com`,
        fullName: 'RBAC Owner',
        passwordHash,
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date('2027-12-31'),
      },
    });

    const member = await prisma.appUser.create({
      data: {
        email: `rbac-member-${ts}@test.com`,
        fullName: 'RBAC Member',
        passwordHash,
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date('2027-12-31'),
      },
    });

    const company = await prisma.company.create({
      data: { name: 'RBAC Company', slug: `rbac-company-${ts}`, ownerId: owner.id },
    });

    await prisma.appUser.update({ where: { id: owner.id }, data: { activeCompanyId: company.id } });

    await prisma.companyMember.create({
      data: { companyId: company.id, userId: member.id, role: 'member' },
    });

    await prisma.appUser.update({ where: { id: member.id }, data: { activeCompanyId: company.id } });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const loginOwner = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: PASSWORD });
    ownerToken = (loginOwner.body as AuthResponse).accessToken;

    const loginMember = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: PASSWORD });
    memberToken = (loginMember.body as AuthResponse).accessToken;
  }, TIMEOUT);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  }, TIMEOUT);

  it('owner can create project (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owner Project' })
      .expect(201);

    const body = res.body as { data: { id: string } };
    projectId = body.data.id;
  });

  it('member can list projects (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect((res.body as ListResponse).success).toBe(true);
  });

  it('member cannot create project (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Member Project' });

    expect(res.status).toBe(403);
  });

  it('member cannot update project (403)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('member cannot archive project (403)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('owner can create task (201)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Owner Task' })
      .expect(201);

    const body = res.body as { data: { id: string } };
    taskId = body.data.id;
  });

  it('member cannot create task (403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Member Task' });

    expect(res.status).toBe(403);
  });

  it('member cannot delete task (403)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('owner can delete task (200)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
