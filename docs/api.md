# API Design

The API is implemented in `apps/api` as a NestJS modular monolith. All workspace-scoped routes must enforce workspace membership and role permissions.

## Router Layout

Current MVP routes are intentionally mounted at root paths:

```txt
/health
/auth
/workspaces
/workflows
/workflow-runs
/ai
/webhooks
/dashboard
/notifications
/audit
/metrics
```

Do not introduce a global `/api/v1` prefix without updating frontend API calls, Postman, docs, and smoke tests.

## Middleware And Boundary

The API currently uses:

- Helmet
- CORS
- global validation pipe
- throttling
- request ID middleware
- trace context propagation through `traceparent`
- request logging middleware
- HTTP exception filter
- Terminus health/readiness checks

## Auth

```txt
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
GET  /auth/google
GET  /auth/google/callback
```

`GET /auth/google` starts the Google OAuth 2.0 server flow and redirects to Google; `GET /auth/google/callback` finishes it and sets the session cookies. Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` before using it locally or in deployment. A first-time Google user gets a personal workspace with role `OWNER`, like email registration. The `state` parameter is signed with `JWT_ACCESS_SECRET`.

`GET /auth/me` (and the `user` object of login/register) returns `workspaces: [{ id, name, slug, role }]`, the caller's memberships. Clients pick the active workspace from this list; they cannot act on a workspace they are not a member of.

Password auth now stores users in PostgreSQL, hashes passwords with argon2, signs access tokens as JWTs, and stores refresh tokens as hashes for rotation/revocation. Local demo logins under `@agentops.local` may be auto-created for smoke tests.

## Workspaces

```txt
GET   /workspaces
POST  /workspaces
GET   /workspaces/:id
PATCH /workspaces/:id
POST  /workspaces/:id/invite
GET   /workspaces/:id/members
PATCH /workspaces/:id/members/:memberId/role
```

## Workflows

```txt
GET    /workflows
POST   /workflows
GET    /workflows/:id
PATCH  /workflows/:id
DELETE /workflows/:id
POST   /workflows/:id/publish
POST   /workflows/:id/run
GET    /workflows/:id/runs
GET    /workflow-runs/:id
GET    /workflow-runs/:id/steps
GET    /workflow-runs/:id/stream                   (Server-Sent Events)
GET    /workflow-runs/approvals?workspaceId=&status=WAITING_APPROVAL|APPROVED|REJECTED|ALL
POST   /workflow-runs/:id/steps/:stepId/approval   { "decision": "approve" | "reject", "comment"?: string }
```

Approval decisions require an access token (`Authorization: Bearer <access token>` or the browser's HttpOnly `agentops_access` cookie); the caller must be a workspace member with role `MEMBER` or higher (VIEWER gets 403). `stepId` accepts the step id (`<runId>_<nodeId>`) or the node id. The first decision wins: later calls return `409` with the stored decision in `details`. Approve publishes `human-approval-decided`; reject marks the step `FAILED`, the run `CANCELLED`, and also publishes the event for the audit trail. Every decision writes an `AuditLog` row.

`GET /workflow-runs/:id/steps` returns a step timeline generated from the immutable workflow version definition attached to the run.

`GET /workflow-runs/:id/stream` (role `VIEWER`, same cookie/bearer auth as the other run endpoints, so `new EventSource(url, { withCredentials: true })` works) streams live run status as `text/event-stream`. Events:

| Event | Data | When |
| --- | --- | --- |
| `snapshot` | `{ run, steps }` (same shapes as `GET /:id` and `GET /:id/steps`) | on connect, then whenever the run status/timestamps or any step id/status/finishedAt changes |
| `ping` | empty | every 15 s, keeps proxies from closing the connection |
| `end` | `{ status }` | the run is no longer active (`COMPLETED`, `FAILED`, `CANCELLED`); sent after the final `snapshot`, then the stream closes |
| `error` | `{ message }` | the run cannot be read (e.g. 404 not found); the stream closes |

The server polls PostgreSQL every second per connection (no Kafka fan-out, so it works with several API replicas) and closes the stream after 30 minutes; clients should reconnect if they still need updates.

Workflow publish/run APIs are durable-first: the API writes workflow versions, runs, and initial step rows to PostgreSQL before publishing the `workflow-triggered` event. The event is stored in `domain_events`, then sent to Kafka using the event type as the topic.

## AI

```txt
POST /ai/test-agent
POST /ai/evaluate-agent
GET  /ai/providers
GET  /ai/tasks/:id
GET  /ai/usage
```

## Webhooks

```txt
POST   /webhooks/:workflowId
GET    /webhooks
POST   /webhooks
DELETE /webhooks/:id
```

## Dashboard

```txt
GET   /dashboard/overview?workspaceId=
GET   /dashboard/workflow-runs?workspaceId=
GET   /dashboard/workflow-runs/count?workspaceId=
GET   /dashboard/usage?workspaceId=
GET   /dashboard/errors?workspaceId=
GET   /dashboard/recent-activity?workspaceId=
GET   /dashboard/readiness?workspaceId=
GET   /dashboard/leads?workspaceId=          scored leads (masked contact fields, score, category, summary)
GET   /dashboard/sales-tasks?workspaceId=    follow-up tasks created by the NOTIFICATION node
PATCH /dashboard/sales-tasks/:id?workspaceId=  { "status": "DONE" | "OPEN" }
```

Every `GET /dashboard/*` route requires `?workspaceId=` and a membership with role `VIEWER` or higher: the guard returns `400` when the query parameter is missing and `403` when the caller is not a member. All data is filtered by that workspace. `PATCH /dashboard/sales-tasks/:id` requires `MEMBER`. The guard uses the `workspaceQuery` scope in `apps/api/src/common/rbac/`.

`GET /dashboard/readiness` returns an operational checklist for the workspace, including workflow publishing, event pipeline activity, AI provider configuration, OpenTelemetry export, and production-secret readiness. Non-ready items include a concrete `action` so the frontend can display the next configuration step.

Dashboard overview, run lists, usage metrics, recent activity, and readiness now read persisted workflow/run/event/usage state instead of process-local memory.

## Platform Admin

Every route under `/admin` requires a platform administrator (`User.isPlatformAdmin`, checked from the database on each
request by `PlatformAdminGuard`); others get 403. `GET /auth/me` returns `isPlatformAdmin`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/overview?days=7\|30\|90` | Platform totals (users, active users 7d, workspaces, workflows, runs by status, success rate, approvals, AI calls/tokens, lead categories, sales tasks), one series row per day (signups, runs, failed runs, AI tokens, approvals), top 5 workspaces by runs, signups by provider. |
| GET | `/admin/users?q=&status=all\|active\|disabled\|admin&page=&pageSize=` | Paged accounts with provider, admin flag, status, workspaces count, created and last login time. |
| GET | `/admin/users/:id` | One account with its workspace memberships. |
| PATCH | `/admin/users/:id` | `{ disabled?, isPlatformAdmin? }`. Disabling revokes all refresh tokens; every change writes an `AuditLog` row with `workspaceId = null`. An admin cannot change their own account (400). |
| GET | `/admin/workspaces?q=&page=&pageSize=` | Paged workspaces with owner, members, workflows, runs and AI tokens. |
| GET | `/admin/audit?action=&page=&pageSize=` | Audit log across the platform, newest first. |
| GET | `/admin/reports/{users\|workspaces\|runs\|usage}.csv?days=` | CSV download (UTF-8 with BOM, formula-injection safe). `runs` and `usage` are limited to the range. |

## Notifications And Alert Bot

```txt
GET  /notifications
POST /notifications/mark-all-read
POST /notifications/alertmanager
```

`POST /notifications/alertmanager` accepts Alertmanager webhook payloads, creates in-app alert notifications, increments `agentops_alertmanager_notifications_total`, and optionally forwards a generic bot payload to `ALERT_BOT_WEBHOOK_URL`.

## Metrics

```txt
GET /metrics
```

Exports Prometheus text-format metrics for:

- API process uptime and resident memory.
- HTTP request totals and duration histograms.
- Workflow run creation totals.
- Kafka consumer lag by `group_id`, `topic`, and `partition`.
- Alertmanager webhook notifications received by the alert bot.

The request boundary accepts or creates W3C `traceparent`, sets `x-request-id`, starts an OpenTelemetry HTTP server span when OTel is enabled, and attaches `requestId`/`traceId`/`traceparent` to domain events so API logs, Kafka events, worker spans, and workflow run logs can be correlated.

## Frontend Integration

`apps/web/src/lib/api.ts` is the web API boundary; response shapes are the zod schemas in `packages/shared/src/views.ts`, shared with the API. Current pages use:

- `/dashboard`: overview, scored leads, sales tasks, workflow runs, dependency health, AI providers, recent activity.
- `/login` and `/register`: password auth through `/auth/login` and `/auth/register`.
- `/auth/callback`: finishes social login; session cookies are already set by the API, the fragment carries only the user profile and redirect path.
- `/workflows`: workflow list, "create from lead template" (`POST /workflows`), publish (blocked client-side while the graph has validation issues), run.
- `/workflows/:id/builder`: React Flow graph with positions for the lead template, labelled branch edges (`leadScore > 80`, dashed `else`) and validation issues.
- `/runs`: run history from `/dashboard/workflow-runs`.
- `/runs/:id`: run metadata and step timeline (status, masked input, output, tokens, duration, errors); polls every 4 s while the run is `PENDING`, `RUNNING` or `WAITING_APPROVAL`.
- `/approvals`: emails waiting for review (polls every 5 s); approve/reject calls `POST /workflow-runs/:id/steps/:stepId/approval` with the user's bearer token.
- `/agents`: AI providers, usage, and test-agent endpoint.
- `/settings`: dependency readiness, operational readiness checklist, and runtime boundary summary.

Server pages call the API with `safeApiGet`. When the API is unreachable they render an error state; demo fallback data is shown only when `NEXT_PUBLIC_DEMO_FALLBACK=true` (off by default).

## Response Rules

- Return stable JSON shapes.
- Include `requestId` in error responses.
- Validate request body, params, and query values.
- Never expose secrets, token hashes, or provider API keys.
