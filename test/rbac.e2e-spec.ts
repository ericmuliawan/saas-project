import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface AuthResponse {
  accessToken: string;
}

interface CompanyResponse {
  data: { id: string };
}

interface ProjectResponse {
  data: { id: string };
}

interface TaskResponse {
  data: { id: string };
}

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let memberToken: string;
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const timestamp = Date.now();

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'RBAC Owner',
        email: `rbac-owner-${timestamp}@test.com`,
        password: 'Password123',
      })
      .expect(201);

    const ownerBody = ownerRes.body as AuthResponse;
    ownerToken = ownerBody.accessToken;

    const memberRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'RBAC Member',
        email: `rbac-member-${timestamp}@test.com`,
        password: 'Password123',
      })
      .expect(201);

    const memberBody = memberRes.body as AuthResponse;
    memberToken = memberBody.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('owner creates company', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'RBAC Company', slug: `rbac-company-${Date.now()}` })
      .expect(201);

    const body = res.body as CompanyResponse;
    expect(body.data.id).toBeDefined();
  });

  it('owner adds member to company', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'rbac-member@test.com', role: 'member' });
  });

  it('owner creates project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'RBAC Project' })
      .expect(201);

    const body = res.body as ProjectResponse;
    projectId = body.data.id;
  });

  it('member can list projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect((res.body as Record<string, unknown>).success).toBe(true);
  });

  it('member cannot create project (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Member Project' });

    expect(res.status).toBe(403);
  });

  it('member cannot archive project (403)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('member cannot delete project (403)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('member cannot create task (403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Member Task' });

    expect(res.status).toBe(403);
  });

  it('member cannot delete task (403)', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Owner Task' })
      .expect(201);

    const body = createRes.body as TaskResponse;
    const taskId = body.data.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
