# Database Design

PostgreSQL stores users, workspaces, workflow definitions, immutable versions, runs, step logs, AI results, tool results, notifications, audit logs, and usage.

## Core Tables

```txt
users
auth_refresh_tokens
workspaces
workspace_members
workflows
workflow_versions
workflow_nodes
workflow_edges
workflow_runs
workflow_step_runs
ai_agent_configs
ai_task_results
tool_configs
tool_call_results
webhook_endpoints
notifications
audit_logs
api_keys
usage_records
billing_plans_mock
domain_events
```

## Important Rules

- One user can belong to multiple workspaces.
- A workflow belongs to one workspace.
- Publishing a workflow creates a new immutable workflow version.
- Draft workflow definitions are stored on `workflows.definition_json`; published immutable definitions are copied to `workflow_versions.definition_json`.
- A workflow run must point to the exact workflow version it executed.
- Step logs must preserve input, output, error, timing, and retry count.
- Usage records must track AI tokens and workflow steps per workspace.
- API-created domain events are stored in `domain_events` before Kafka publish is attempted.
- Refresh tokens are stored only as hashes and can be revoked.

## Status Enums

Workflow:

```txt
DRAFT
ACTIVE
PAUSED
ARCHIVED
```

Workflow run:

```txt
PENDING
RUNNING
WAITING_APPROVAL
COMPLETED
FAILED
CANCELLED
```

Human approval:

```txt
WAITING_APPROVAL
APPROVED
REJECTED
EXPIRED
```

## Migrations

Schema changes ship as versioned Prisma migrations in `packages/database/prisma/migrations` (no more `db push`):

```bash
pnpm db:migrate                # dev: create a migration from schema.prisma changes
pnpm db:migrate:deploy         # apply pending migrations (CI, containers, deployments)
pnpm db:migrate:status
```

- `20261018000000_init` matches the schema as it was when migrations were introduced.
- `20261018120000_indexes_and_constraints` adds the hot-query indexes and constraints below.

## Seeds

- `pnpm db:seed` (`scripts/seed-required.ts`): reference data every environment needs (billing plans). Idempotent.
- `pnpm db:seed:demo` (`scripts/seed-demo.ts`): demo user, workspace, lead workflow, run and events. Local/demo only.
- `pnpm db:reset` (`scripts/db-reset.ts`): `prisma migrate reset` + both seeds. Refuses to run unless the database host is local (`localhost`, `127.0.0.1`, `postgres`) and `APP_ENV=local` (and `NODE_ENV` is not `production`).

## Indexes For Hot Queries

| Query | Index |
| --- | --- |
| Run lists per workspace / workflow, status filters | `WorkflowRun(workspaceId, createdAt)`, `(workflowId, createdAt)`, `(status, createdAt)` |
| Step timeline of a run | unique `WorkflowStepRun(workflowRunId, nodeId)` |
| Events of a run, outbox relay | `DomainEvent(workflowRunId, createdAt)`, `(kafkaPublishedAt, createdAt)` |
| Daily AI quota | `UsageRecord(workspaceId, createdAt)` |
| Approval queue | `HumanApproval(workspaceId, status, requestedAt)` |
| Sales tasks / notifications | `Notification(workspaceId, type, createdAt)` |
| Dashboard leads | `AiTaskResult(workspaceId, createdAt)` |

## Constraints

- Idempotency: unique `ProcessedMessage(consumerGroup, idempotencyKey)`; one row per node per run for `AiTaskResult`, `ToolCallResult`, `HumanApproval`, `WorkflowStepRun`.
- Cascades are intentional: deleting a workspace removes its workflows, runs and their results; deleting a run removes its steps, results, approvals and domain events.
- `WorkflowRun -> WorkflowVersion` is restrictive: a version cannot be deleted while runs reference it (runs must point at the exact version they executed).
- Audit logs, approvals and notifications keep their rows (`SET NULL`) when the acting user is deleted.

## Domain Event Outbox

The API writes a `DomainEvent` row before publishing to Kafka, then sets `kafkaPublishedAt` or `kafkaError`. A relay in `DomainEventsService` re-sends rows still unpublished after 10 s (every `DOMAIN_EVENT_RELAY_INTERVAL_MS`, default 30 s; `0` disables it). Consumers are idempotent, so a duplicate send is harmless.
