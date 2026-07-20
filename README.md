# SaaS Project Management API

Mini Project Management backend — multi-tenant SaaS dibangun dengan NestJS, Prisma, dan PostgreSQL.

## Tech Stack

- **Runtime**: Node.js + NestJS 11
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (15 menit TTL)
- **Queue**: BullMQ + Redis (background job)
- **Testing**: Jest + Supertest

## Cara Menjalankan

### 1. Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saas_project?schema=public"
JWT_SECRET="your-secret-key-min-32-characters-long"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Migration

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Seed Data

```bash
npm run seed
```

### 5. Jalankan Server

```bash
npm run start:dev
```

Server berjalan di `http://localhost:3000/api/v1`

### 6. Jalankan Tests

```bash
npm run test:e2e
```

---

## Strategi Multi-Tenancy

### Yang Dipilih: Row-Level Scoping (RLS)

Setiap tabel memiliki kolom `company_id`. Tenant isolation dijamin di **3 layer**:

#### Layer 1 — Application Level (`withTenant()`)
```typescript
await prisma.withTenant(companyId, async (tx) => {
  // Semua query di sini otomatis di-scope ke companyId
});
```
Setiap request yang membutuhkan tenant context menjalankan seluruh operasi database dalam satu transaksi yang dimulai dengan `SET app.company_id`.

#### Layer 2 — Database Level (PostgreSQL RLS)
```sql
CREATE POLICY company_isolation ON projects
  USING (company_id = current_setting('app.company_id')::uuid);
```
RLS memastikan meskipun ada bug di application code, database tetap memblokir akses cross-tenant.

#### Layer 3 — Application Guard
```typescript
@RequireTenant()  // Memastikan user punya activeCompanyId
@Roles('owner', 'admin')  // Memastikan role cukup
```
Guard pipeline memvalidasi JWT, resolve tenant dari `user.activeCompanyId`, dan enforce RBAC.

### Tenant Dari Mana?

Tenant **selalu di-resolve dari `request.user.companyId`** — tidak pernah dari URL parameter atau request body. Client tidak bisa menebak atau memanipulasi `companyId`.

### Kenapa RLS?

| Strategy | Kelebihan | Kekurangan |
|----------|-----------|------------|
| **Row-Level (RLS)** ✅ | Simple, satu DB, RLS sebagai safety net | Query performance di scale sangat besar |
| Schema-per-tenant | Isolasi lebih kuat | Migration ribet, connection pool mahal |
| Database-per-tenant | Isolasi sempurna | Overhead infra, backup/restore per tenant |

RLS dipilih karena:
1. Untuk SaaS MVP, ini paling cepat diimplementasikan
2. PostgreSQL RLS sudah battle-tested
3. Double protection (app + DB) mengurangi risiko data leak

---

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register user baru | Public |
| POST | `/api/v1/auth/login` | Login | Public |

### Projects
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/v1/projects` | Buat project | Owner/Admin |
| GET | `/api/v1/projects` | List semua project | Semua |
| GET | `/api/v1/projects/:id` | Detail project | Semua |
| PATCH | `/api/v1/projects/:id` | Update project | Owner/Admin |
| PATCH | `/api/v1/projects/:id/archive` | Archive project | Owner/Admin |

### Tasks
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/v1/projects/:projectId/tasks` | Buat task | Owner/Admin |
| GET | `/api/v1/projects/:projectId/tasks` | List tasks | Semua |
| GET | `/api/v1/projects/:projectId/tasks/:id` | Detail task | Semua |
| PATCH | `/api/v1/projects/:projectId/tasks/:id` | Update task | Owner/Admin + Member (own task only) |
| DELETE | `/api/v1/projects/:projectId/tasks/:id` | Hapus task | Owner/Admin |

### Members
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/v1/members` | Tambah member | Owner/Admin |
| GET | `/api/v1/members` | List members | Semua |
| PATCH | `/api/v1/members/:userId/role` | Ubah role | Owner |
| DELETE | `/api/v1/members/:userId` | Hapus member | Owner/Admin |

### Response Format

```json
// Success
{ "success": true, "data": { ... } }

// List
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 50 } }

// Error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Project not found" } }
```

---

## Access Control

| Action | Owner | Admin | Member |
|--------|:-----:|:-----:|:------:|
| View projects & tasks | ✅ | ✅ | ✅ |
| Create/edit/archive projects | ✅ | ✅ | ❌ |
| Create/edit/delete any task | ✅ | ✅ | ❌ |
| Update assigned task | ✅ | ✅ | ✅ (own only) |
| Invite/remove/change member roles | ✅ | ✅ | ❌ |
| Change member role | ✅ | ❌ | ❌ |

---

## Background Job

Sistem notifikasi menggunakan **BullMQ + Redis** untuk memproses job di luar request cycle.

**Contoh job**: Ketika task di-assign ke user, notifikasi dikirim secara async.

```
Request → TaskService → Queue (Redis) → Worker → Console Log (mock email)
```

Worker akan melakukan retry dengan exponential backoff (3 attempts) jika gagal.

---

## Seed Data

| User | Email | Password | Company | Role |
|------|-------|----------|---------|------|
| Alice | alice@example.com | Password123 | acme-corp | owner |
| Bob | bob@example.com | Password123 | globex-inc | owner |
| Charlie | charlie@example.com | Password123 | acme-corp | member |
