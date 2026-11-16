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

## Frontend Contract

`apps/web` is implemented as a separate Next.js deployable app. It uses `apps/web/DESIGN.md` for UI direction, keeps Vietnamese and English copy in `apps/web/src/lib/i18n.ts`, and reads backend data through `apps/web/src/lib/api.ts`.

Current live integrations:

- dashboard overview, runs, health, AI providers, and recent events.
- workflow list, publish action, run action, and builder graph definition.
- AI provider usage and test-agent execution.
- settings readiness summary.

Fallback data is allowed only to keep builds and demos resilient when the API is not running; real workflows should use the NestJS API.

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

## Lead Flow Across API, Kafka, And Workers

```txt
Lead (manual run or POST /webhooks/:workflowId)
  |
  v
NestJS API  -- creates workflow_run + step rows, writes domain_events (outbox),
               then publishes workflow-triggered
  |
  v
+-------------------+   agent-task-requested    +-------------+
|  workflow-worker  | ------------------------> |  ai-worker  |
|  owns run state;  | <------------------------ |  agent-task-|
|  pauses at AI /   |   agent-task-completed    |  completed  |
|  tool / approval  |                           +-------------+
|  nodes and        |   tool-call-requested     +-------------+
|  resumes on       | ------------------------> | tool-worker |
|  completion       | <------------------------ |  tool-call- |
|  events           |   tool-call-completed     |  completed  |
|                   |                           +-------------+
|                   |   notification-requested  +---------------------+
|                   | ------------------------> | notification-worker |
|                   |                           +---------------------+
|                   |
|                   |   human-approval-requested -> run = WAITING_APPROVAL
+-------------------+
  |                              |
  |  API: POST /workflow-runs/:id/steps/:stepId/approval  (JWT + MEMBER)
  |                              | publishes human-approval-decided
  v                              v
workflow-completed / workflow-failed  ->  API dashboard listeners
```

## Execution Model

- The `workflow-worker` owns run state: it writes step status, outputs, AI/tool results, approvals and the internal run context in one transaction before publishing the next events.
- It executes the immutable workflow version step by step and **pauses** at every AI, tool, and human-approval node after publishing the task request.
- It **resumes** when the matching completion event arrives (`agent-task-completed`, `tool-call-completed`, `human-approval-decided`), merges the node output into the context, and continues to the next nodes.
- Context is stored on the run and is the accumulated trigger input plus node outputs. AI output is flattened so fields like `leadScore` are directly addressable by later nodes.
- Condition edges use `<path> <op> <literal>` with `> >= < <= == !=`; a score of exactly 80 or higher takes `leadScore > 80`, otherwise the sibling `else` edge fires when no condition matched.

## Delivery Guarantees

- Idempotency key `workflowRunId:nodeId:eventType`, stored per consumer group in `ProcessedMessage` (unique index). A redelivered message is skipped.
- A failing handler is retried up to **3 attempts** (200 ms, 400 ms backoff); `NonRetryableError` (invalid AI output after `retryLimit`, quota exceeded, missing API key) skips retries.
- After the last attempt the message goes to `dead-letter-events` with the error and original event, and `workflow-step-failed` is published so the run ends `FAILED` instead of hanging.
- Offsets are committed only after the handler, the Kafka publish, and the idempotency record have completed (durable writes first).
- Domain events are persisted in the outbox and published to Kafka in batches, which cuts per-event round trips.
- Each topic has **3 partitions**; every worker consumes those 3 partitions in parallel.

## API Outbox

The API is durable-first: it writes a `DomainEvent` row before attempting the Kafka publish, then records `kafkaPublishedAt` or `kafkaError`. A relay in `DomainEventsService` re-sends rows that are still unpublished, retrying every **30 s** (`DOMAIN_EVENT_RELAY_INTERVAL_MS`, default `30000`; `0` disables it). Consumers are idempotent, so a duplicate send is harmless.

## Human Approval

- A `HUMAN_APPROVAL` node stores a `HumanApproval` row (masked lead, assessment, and drafted email) and puts the run in `WAITING_APPROVAL`.
- Reviewers decide via `POST /workflow-runs/:id/steps/:stepId/approval`. It requires a JWT plus the `MEMBER` role (or higher) in the workspace; the first decision wins and later calls return `409` with the stored decision.
- Approve publishes `human-approval-decided` and the run continues; reject marks the step `FAILED` and the run `CANCELLED`.
- `WORKFLOW_AUTO_APPROVE=true` skips approval nodes, but is only honoured with `APP_ENV=local`. The default is `false`, and every other environment always waits for a reviewer.

## AI Safety

- PII (emails, phone numbers, secret-like keys) is masked before prompts are built.
- Output is validated against the configured JSON Schema, retrying invalid JSON only within `retryLimit`; after that the step fails and the result is not used.
- A prompt-injection guardrail runs on lead scoring before provider calls.
- Daily quotas per workspace: `AI_DAILY_CALL_LIMIT` (default 100) and `AI_DAILY_TOKEN_LIMIT` (default 200000).
- A labeled golden set gates prompt changes: run `pnpm eval:leads` and compare the pass rate before and after.

## Security

- Browser sessions are HttpOnly cookies set by the API on login/register/refresh/Google callback and cleared on logout: `agentops_access` (JWT, `Path=/`, 15 min) and `agentops_refresh` (`Path=/auth`, 30 days), `SameSite=Lax`, `Secure` outside `APP_ENV=local`, optional `AUTH_COOKIE_DOMAIN`. The web never stores tokens: browser fetches send `credentials: "include"` (one refresh-and-retry on 401) and server components forward the incoming Cookie header. Non-browser clients (Postman, k6, integration tests) get tokens in the JSON body and send `Authorization: Bearer`.
- Global guards run in order `ThrottlerGuard` -> `CsrfOriginGuard` -> `JwtAuthGuard`. `CsrfOriginGuard` rejects cookie-authenticated (or `/auth/*`) POST/PUT/PATCH/DELETE requests whose `Origin`/`Referer` is not the `WEB_APP_URL` origin; Bearer requests skip it. CORS allows credentials for the `WEB_APP_URL` origin only.
- Every API route requires a valid access token (Bearer header, else the `agentops_access` cookie) through the global `JwtAuthGuard`. Public routes are explicit via `@Public()`: health (`/health/live`, `/health/ready`), `/metrics`, `POST /auth/login|register|refresh|logout` (logout revokes by refresh token), the Google OAuth redirects `GET /auth/google` and `/auth/google/callback`, the inbound mock webhook `POST /webhooks/:workflowId`, and `POST /notifications/alertmanager` (requires `Authorization: Bearer $ALERTMANAGER_WEBHOOK_TOKEN`; without a token only `APP_ENV=local` is accepted).
- `WorkspaceRoleGuard` resolves the workspace (workspace `:id`, a workflow's workspace, or `workspaceId` from body/query) and checks the caller's `WorkspaceMember` role: VIEWER for reads, MEMBER for create/update/run, ADMIN for publish/delete/invite, OWNER for member role changes. Lists (`GET /workflows`, `GET /workspaces`) only return the caller's workspaces. Unauthenticated -> 401, not a member or role too low -> 403.
- RBAC roles come from the JWT plus workspace membership; client-supplied roles (for example an `x-workspace-role` header) are not trusted for authorization decisions.
- Rate limiting is applied globally via `API_RATE_LIMIT_PER_MINUTE` (default 120 per IP per minute), with `AUTH_RATE_LIMIT_PER_MINUTE` (default 10) on login/register/refresh; health and metrics are never throttled. Behind ingress-nginx set `API_TRUST_PROXY=1` (hop count, never `true`) so the limit applies per client IP. Limits are per API replica (in-memory store).
- Logs are redacted (`email`, `phone`, `input`, `context`, `authorization`, `apiKey` -> `[REDACTED]`); prompts and lead input are never logged.

## Observability

- RED metrics: throughput, error ratio, and p50/p95/p99 latency for the API and each worker.
- AI/cost metrics: calls by status, tokens in/out, estimated cost, valid-JSON ratio, retries, and quota rejections.
- Business metrics: leads scored by category, branch A/B ratio, approvals requested vs decided, emails waiting, and sales tasks created.
- Kafka health: consumer lag per group/topic/partition, dead letters, message outcomes, and outbox backlog.
- Per-node OpenTelemetry spans in Tempo (`workflow.node <TYPE>`, `ai.call`), so one lead is one trace across API and workers.
- Grafana dashboards (RED, AI, Kafka, Lead flow, Overview) and a Prometheus alert-rule set from `infrastructure/observability/`.

## Deployment Shapes

- **Local:** docker compose for PostgreSQL, Redis, Kafka, observability, and the app/worker containers.
- **Kubernetes:** kustomize `base` plus overlays. `dev` runs on k3s with in-cluster data services; `prod` runs on EKS with managed RDS, ElastiCache, and MSK.
- **Terraform:** reusable modules with per-environment entrypoints (`bootstrap`, `dev`, `prod`).
- **CI/CD:** GitHub Actions pipelines for quality/integration/security/infra checks, dev auto-deploy, and manual prod promotion.
