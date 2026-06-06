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

## Planned Stack

- NestJS
- Prisma
- PostgreSQL
- Redis
- Kafka client
- JWT auth
- Swagger/OpenAPI
- Jest

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
  common/
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

