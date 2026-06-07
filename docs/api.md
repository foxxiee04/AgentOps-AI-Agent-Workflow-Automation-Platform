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
```

Do not introduce a global `/api/v1` prefix without updating frontend API calls, Postman, docs, and smoke tests.

## Middleware And Boundary

The API currently uses:

- Helmet
- CORS
- global validation pipe
- throttling
- request ID middleware
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

`GET /auth/google` starts the Google OAuth 2.0 server flow and redirects to Google. Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` before using it locally or in deployment.

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
```

`GET /workflow-runs/:id/steps` returns a step timeline generated from the immutable workflow version definition attached to the run.

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
GET /dashboard/overview
GET /dashboard/workflow-runs
GET /dashboard/usage
GET /dashboard/errors
GET /dashboard/recent-activity
```

## Frontend Integration

`apps/web/src/lib/api.ts` is the web API boundary. Current pages use:

- `/dashboard`: dashboard overview, workflow runs, readiness, AI providers, recent activity.
- `/login` and `/register`: password auth through `/auth/login` and `/auth/register`.
- `/auth/callback`: stores OAuth callback session fragments from social login.
- `/workflows`: workflow list, publish action, run action.
- `/workflows/:id/builder`: workflow detail for React Flow nodes and edges.
- `/runs`: workflow run history from `/dashboard/workflow-runs`.
- `/runs/:id`: workflow run metadata and step timeline from `/workflow-runs/:id` and `/workflow-runs/:id/steps`.
- `/agents`: AI providers, usage, and test-agent endpoint.
- `/settings`: readiness status and runtime boundary summary.

Server pages call the API with `safeApiGet`, which returns fallback data when the API is offline so builds and demos remain usable.

## Response Rules

- Return stable JSON shapes.
- Include `requestId` in error responses.
- Validate request body, params, and query values.
- Never expose secrets, token hashes, or provider API keys.
