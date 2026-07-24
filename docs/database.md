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
