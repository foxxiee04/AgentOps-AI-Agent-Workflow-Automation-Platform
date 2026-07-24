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
- Prometheus metrics and Alertmanager webhook ingestion.
- Kafka event publishing.
- Liveness/readiness checks for API, PostgreSQL, Redis, and Kafka.

## Current Persistence Path

- Auth users and refresh tokens are stored in PostgreSQL; access tokens are JWTs.
- Demo workspace/workflow records are seeded idempotently when API surfaces need them.
- Workflow drafts store `definitionJson`; publishing copies that graph into immutable `workflow_versions`.
- Workflow runs create durable run and initial step rows before the API sends `workflow-triggered` to Kafka.
- API domain events are stored in `domain_events` with Kafka publish status for recent activity and debugging.
- `/ai/test-agent` records API-side token usage in `usage_records`; worker-side provider usage should write the same table next.
- Dashboard overview and usage metrics read `workflow_runs`, `domain_events`, and `usage_records`.

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
- operational readiness checklist for workflow, event, AI provider, observability, and production secret configuration.
- notifications and alert bot webhook ingestion.
- Prometheus `/metrics` for local observability.
- workflow list/detail, publish, run, and run step timeline.
- health readiness for settings and dashboard dependency status.
- AI provider status, AI usage, and test-agent execution.

Keep `apps/web/src/lib/api.ts`, Postman, and `docs/api.md` synchronized when these response shapes change.
