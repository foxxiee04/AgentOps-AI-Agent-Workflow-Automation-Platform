---
name: agentops-backend
description: Guide AgentOps backend work. Use when implementing or reviewing NestJS modular monolith APIs, Prisma/database changes, auth, workspace RBAC, workflow CRUD, workflow publishing/runs, dashboard APIs, webhook APIs, or backend tests in apps/api and packages/database.
---

# AgentOps Backend

## Workflow

1. Read `CODEX.md`.
2. Read `apps/api/README.md`.
3. Read `docs/api.md`, `docs/database.md`, and `docs/security.md`.
4. Inspect existing modules before adding a new one.
5. Keep controllers thin and put business rules in services/domain helpers.

## Module Rules

- Group code by domain module.
- Validate DTOs at request boundaries.
- Enforce workspace membership and role authorization on workspace routes.
- Keep workflow publish validation deterministic.
- Create durable database state before publishing Kafka events.
- Do not mutate published workflow versions.

## Data Rules

- Use transactions for operations that create related records.
- Store workflow runs against a specific workflow version.
- Store step-run inputs, outputs, retry count, timing, and error messages.
- Track AI usage by workspace.

## Testing Priorities

- Auth and RBAC.
- Workflow publish validation.
- Workflow run creation.
- Event publishing after persistence.
- API input validation and error responses.

