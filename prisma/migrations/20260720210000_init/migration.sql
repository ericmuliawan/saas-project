-- Initial PostgreSQL schema for a SaaS where an active user subscription unlocks
-- company creation. All company-owned data is isolated by company_id.
--
-- The API must set the selected company for each tenant-scoped transaction:
--   SET LOCAL app.company_id = '<company UUID>';

create extension if not exists pgcrypto;

create table app_users (
  id uuid primary key default gen_random_uuid(),
  email varchar(320) not null unique,
  full_name varchar(150) not null,
  password_hash varchar(255) not null,
  active_company_id uuid,
  subscription_status varchar(20) not null default 'inactive',
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_subscription_status check (
    subscription_status in ('inactive', 'active', 'cancelled', 'expired')
  ),
  constraint active_subscription_has_end_date check (
    subscription_status <> 'active' or subscription_ends_at is not null
  )
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_users(id) on delete restrict,
  name varchar(150) not null,
  slug varchar(100) not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint companies_id_owner_unique unique (id, owner_id)
);

create table company_members (
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role varchar(20) not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (company_id, user_id),
  constraint company_members_role check (role in ('owner', 'admin', 'member')),
  constraint company_members_user_company_unique unique (user_id, company_id)
);

alter table app_users
  add constraint app_users_active_company_id_fkey
  foreign key (active_company_id)
  references companies(id)
  on delete set null;

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name varchar(200) not null,
  description text,
  status varchar(20) not null default 'active',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_status check (status in ('active', 'archived')),
  constraint projects_id_company_unique unique (id, company_id),
  constraint projects_creator_is_member
    foreign key (created_by, company_id)
    references company_members (user_id, company_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null,
  title varchar(300) not null,
  description text,
  status varchar(20) not null default 'todo',
  priority varchar(10) not null default 'medium',
  assignee_id uuid,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_status check (status in ('todo', 'in_progress', 'done')),
  constraint tasks_priority check (priority in ('low', 'medium', 'high')),
  constraint tasks_project_same_company
    foreign key (project_id, company_id)
    references projects (id, company_id)
    on delete cascade,
  constraint tasks_assignee_is_member
    foreign key (assignee_id, company_id)
    references company_members (user_id, company_id)
);

create index company_members_user_id_idx on company_members (user_id);
create index projects_company_id_idx on projects (company_id);
create index tasks_company_project_idx on tasks (company_id, project_id);
create index tasks_company_assignee_idx on tasks (company_id, assignee_id)
  where assignee_id is not null;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function require_active_subscription_for_company()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from app_users
    where id = new.owner_id
      and subscription_status = 'active'
      and subscription_ends_at > now()
  ) then
    raise exception 'An active subscription is required to create a company';
  end if;
  return new;
end;
$$;

-- The creator is always an owner of the new company.
create or replace function add_company_owner_as_member()
returns trigger
language plpgsql
as $$
begin
  insert into company_members (company_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

-- A user can only make a company active after joining it.
create or replace function require_active_company_membership()
returns trigger
language plpgsql
as $$
begin
  if new.active_company_id is not null and not exists (
    select 1
    from company_members
    where company_id = new.active_company_id and user_id = new.id
  ) then
    raise exception 'A user can only select a company they belong to';
  end if;
  return new;
end;
$$;

-- The first company created by a user becomes their active tenant.
create or replace function set_first_company_as_active()
returns trigger
language plpgsql
as $$
begin
  update app_users
  set active_company_id = new.id
  where id = new.owner_id and active_company_id is null;
  return new;
end;
$$;

create trigger app_users_set_updated_at
before update on app_users for each row execute function set_updated_at();
create trigger app_users_require_active_company_membership
before update of active_company_id on app_users
for each row execute function require_active_company_membership();
create trigger companies_set_updated_at
before update on companies for each row execute function set_updated_at();
create trigger projects_set_updated_at
before update on projects for each row execute function set_updated_at();
create trigger tasks_set_updated_at
before update on tasks for each row execute function set_updated_at();

create trigger companies_require_active_subscription
before insert on companies
for each row execute function require_active_subscription_for_company();
create trigger companies_add_owner_as_member
after insert on companies
for each row execute function add_company_owner_as_member();
create trigger companies_set_first_company_as_active
after insert on companies
for each row execute function set_first_company_as_active();

-- Defense in depth: PostgreSQL rejects data outside the selected company.
alter table companies enable row level security;
alter table company_members enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;

create policy companies_tenant_isolation on companies
  using (id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.company_id', true), '')::uuid);

create policy company_members_tenant_isolation on company_members
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

create policy projects_tenant_isolation on projects
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

create policy tasks_tenant_isolation on tasks
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
