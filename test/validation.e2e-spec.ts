import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface AuthResponse {
  accessToken: string;
}

interface ProjectResponse {
  data: { id: string; name: string };
}

describe('Input Validation (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;

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

    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Validation Owner',
        email: `validation-owner-${Date.now()}@test.com`,
        password: 'Password123',
      })
      .expect(201);

    const body = ownerRes.body as AuthResponse;
    ownerToken = body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

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

    const projectBody = projectRes.body as ProjectResponse;

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

    const projectBody = projectRes.body as ProjectResponse;

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
    const data = body.data as ProjectResponse['data'];
    expect(data.name).toBe('Valid Project');
  });
});
