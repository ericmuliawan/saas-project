# SaaS database ERD

```mermaid
erDiagram
    APP_USERS ||--o{ COMPANIES : creates
    APP_USERS ||--o{ COMPANY_MEMBERS : joins
    COMPANIES ||--o{ COMPANY_MEMBERS : has
    COMPANIES ||--o{ PROJECTS : owns
    COMPANY_MEMBERS ||--o{ PROJECTS : creates
    COMPANIES ||--o{ TASKS : scopes
    PROJECTS ||--o{ TASKS : contains
    COMPANY_MEMBERS o|--o{ TASKS : assigned_to

    APP_USERS {
        uuid id PK
        varchar email UK
        varchar full_name
        varchar subscription_status
        timestamptz subscription_ends_at
    }

    COMPANIES {
        uuid id PK
        uuid owner_id FK
        varchar name
        varchar slug UK
    }

    COMPANY_MEMBERS {
        uuid company_id PK_FK
        uuid user_id PK_FK
        varchar role
        timestamptz joined_at
    }

    PROJECTS {
        uuid id PK
        uuid company_id FK
        uuid created_by FK
        varchar name
        varchar status
    }

    TASKS {
        uuid id PK
        uuid company_id FK
        uuid project_id FK
        uuid assignee_id FK
        varchar title
        varchar status
        varchar priority
        date due_date
    }
```

## Application flow

1. User registers or logs in.
2. The application records `subscription_status` and `subscription_ends_at` on
   `app_users`.
3. Only a user whose status is `active` and whose subscription has not ended may
   create a company. The database trigger enforces this rule.
4. The database automatically adds that user to `company_members` with the
   `owner` role.
5. Projects and tasks are scoped with `company_id`. Composite foreign keys stop
   a task, creator, or assignee from referencing another company's records.

## Tenant isolation

For every tenant-scoped transaction, the API must first set the company chosen
by the authenticated member:

```sql
SET LOCAL app.company_id = 'the-active-company-uuid';
```

The API must verify that the current user belongs to that company before setting
this value. PostgreSQL Row Level Security then prevents reading or changing rows
from another company.
