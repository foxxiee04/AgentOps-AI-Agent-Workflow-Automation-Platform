# Architecture

AgentOps uses **Modular Monolith + Kafka Workers**.

```txt
Next.js Web
  -> NestJS API
    -> PostgreSQL
    -> Redis
    -> Kafka topics
      -> Workflow Worker
      -> AI Worker
      -> Tool Worker
      -> Notification Worker
```

## Decisions

| Decision | Choice |
| --- | --- |
| Core backend | NestJS modular monolith |
| Async execution | Kafka workers |
| Frontend | Next.js App Router |
| Workflow builder | React Flow |
| Database | PostgreSQL via Prisma |
| Cache/status | Redis |
| Local infra | Docker Compose |
| Cloud deployment | Kubernetes, Terraform |

## Why Modular Monolith

The core product has shared domain rules: users, workspaces, workflow versions, permissions, runs, usage, and audit logs. Keeping those in one NestJS application reduces operational complexity while still showing distributed systems skill through Kafka workers.

Frontend and backend are already separated as deployable apps:

- `apps/web`: Next.js UI, routing, dashboard, workflow builder.
- `apps/api`: NestJS backend, REST API, domain modules, database boundary, Kafka publishing.

They are kept in one monorepo so contracts, schemas, docs, and CI can stay coordinated. They should not be split into separate repositories until deployment/team boundaries make that useful.

## Why Only Four Workers

The worker count maps to async domains, not to every backend module:

| Worker | Why It Is Separate |
| --- | --- |
| `workflow-worker` | Coordinates graph execution and can scale with workflow run volume. |
| `ai-worker` | Handles slow provider calls, prompt validation, token metadata, and provider secrets. |
| `tool-worker` | Isolates outbound webhook/http/email mock action execution and timeout/retry rules. |
| `notification-worker` | Handles notification side effects and future delivery channels. |

Do not create a worker for every module. Add a worker only when the work is slow, retryable, independently scalable, or has a distinct security/runtime profile.

## Runtime Components

- `apps/web`: public landing page, auth screens, dashboard, workflow builder, run history.
- `apps/api`: auth, workspace, workflow CRUD, publish/run APIs, dashboard APIs, webhook ingestion.
- `apps/workflow-worker`: graph execution coordinator and run state machine.
- `apps/ai-worker`: AI provider execution and structured output validation.
- `apps/tool-worker`: webhook/http/email mock execution.
- `apps/notification-worker`: in-app notifications and mock delivery.

## API Boundary Components

The API boundary currently includes:

- Helmet
- CORS
- global validation pipe
- throttling
- request ID middleware
- request logging middleware
- HTTP exception filter
- Terminus liveness/readiness checks

## Shared Packages

- `packages/shared`: enums, DTO-like schemas, shared utility types.
- `packages/events`: Kafka topic names, event envelope, event payload schemas.
- `packages/database`: Prisma schema, migrations, seed data.
- `packages/config`: env validation and shared runtime config.
- `packages/ui`: reusable UI primitives once components are shared.
