# API

`apps/api` is the NestJS modular monolith for AgentOps.

## Responsibilities

- Authentication and session management.
- Workspace and RBAC enforcement.
- Workflow CRUD, validation, publishing, and run requests.
- Webhook endpoint management.
- Dashboard metrics.
- AI task test endpoints and usage reporting.
- Audit logs and notifications.
- Kafka event publishing.
- Liveness/readiness checks for API, PostgreSQL, Redis, and Kafka.

## Planned Stack

- NestJS
- Prisma
- PostgreSQL
- Redis
- Kafka client
- NestJS Terminus
- JWT auth
- Swagger/OpenAPI
- Vitest

## Suggested Module Layout

```txt
src/
  modules/
    auth/
    workspaces/
    workflows/
    workflow-runs/
    ai/
    webhooks/
    dashboard/
    notifications/
    audit/
    health/
  common/
    infrastructure/
    http/
    guards/
    decorators/
    filters/
    interceptors/
    validation/
```

## API Rules

- Enforce workspace authorization in every workspace-scoped route.
- Publish Kafka events only after durable database state is created.
- Use explicit DTO/schema validation.
- Keep business rules in services/domain helpers, not controllers.

## Frontend Consumers

`apps/web` currently consumes these API surfaces:

- auth login/register/me plus Google OAuth start/callback.
- dashboard overview, workflow runs, usage, errors, and recent activity.
- workflow list/detail, publish, run, and run step timeline.
- health readiness for settings and dashboard dependency status.
- AI provider status, AI usage, and test-agent execution.

Keep `apps/web/src/lib/api.ts`, Postman, and `docs/api.md` synchronized when these response shapes change.
