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
  data: { id: string; name: string };
}

interface TaskResponse {
  data: { id: string };
}

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication<App>;
  let userAToken: string;
  let userBToken: string;
  let companyAId: string;
  let projectAId: string;
  let taskAId: string;

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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('register user A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'User A Tenant Test',
        email: `tenant-a-${Date.now()}@test.com`,
        password: 'Password123',
      })
      .expect(201);

    const body = res.body as AuthResponse;
    userAToken = body.accessToken;
    expect(userAToken).toBeDefined();
  });

  it('register user B', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'User B Tenant Test',
        email: `tenant-b-${Date.now()}@test.com`,
        password: 'Password123',
      })
      .expect(201);

    const body = res.body as AuthResponse;
    userBToken = body.accessToken;
    expect(userBToken).toBeDefined();
  });

  it('user A creates company A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Owner A',
        email: `owner-a-${Date.now()}@test.com`,
        password: 'Password123',
      })
      .expect(201);

    const authBody = res.body as AuthResponse;
    userAToken = authBody.accessToken;

    const createCompanyRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Company A', slug: `company-a-${Date.now()}` })
      .expect(201);

    const companyBody = createCompanyRes.body as CompanyResponse;
    companyAId = companyBody.data.id;
    expect(companyAId).toBeDefined();
  });

  it('user A creates project and task in company A', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Project A' })
      .expect(201);

    const projectBody = projectRes.body as ProjectResponse;
    projectAId = projectBody.data.id;

    const taskRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectAId}/tasks`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: 'Task A' })
      .expect(201);

    const taskBody = taskRes.body as TaskResponse;
    taskAId = taskBody.data.id;
  });

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
      .send({ name: 'Hacked Project' });

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

  it('user B sees empty project list (no access to A projects)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    const projects = (body.data as Array<{ id: string }>) ?? [];
    const hasProjectA = projects.some((p) => p.id === projectAId);
    expect(hasProjectA).toBe(false);
  });
});
