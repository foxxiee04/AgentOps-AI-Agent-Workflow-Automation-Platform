# Dashboard Module

Provides dashboard summary endpoints.

Expected data:

- workflow run counts
- failed run counts
- AI usage
- recent activity
- recent errors
- operational readiness actions for workflow publishing, event activity, AI provider configuration, observability, and production secrets

Keep expensive aggregation bounded and cache where useful.

## Workflow runs

`GET /dashboard/workflow-runs` returns an array of runs (the web app parses it that way) and accepts
`limit` (1..200, default 50), `offset` (>= 0, default 0), `status` (a WorkflowRun status) and
`workflowId`. Every item carries `workflowName` (joined from `Workflow.name`) so the UI does not
have to resolve ids.

The number of rows matching the filters is published in the `X-Total-Count` response header. CORS
does not expose that header yet, so `GET /dashboard/workflow-runs/count` returns the same total as
`{ "total": number }` for browser clients.

## Sales tasks

Sales tasks are `Notification` rows with `type = "SALES_TASK"`. `GET /dashboard/sales-tasks` maps the
stored notification status to `OPEN`/`DONE`, adds `overdue` (open tasks whose `metadataJson.dueAt`
is in the past) and lists open tasks before done ones, newest first.

`PATCH /dashboard/sales-tasks/:id` accepts `{ "status": "DONE" | "OPEN" }` and stores `DONE` or
`UNREAD`. The caller must be a member (role >= `MEMBER`) of the workspace that owns the task.
