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
```

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

## Response Rules

- Return stable JSON shapes.
- Include `requestId` in error responses.
- Validate request body, params, and query values.
- Never expose secrets, token hashes, or provider API keys.
