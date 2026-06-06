# Workflow Worker

`apps/workflow-worker` coordinates workflow execution.

## Responsibilities

- Consume `workflow-triggered`.
- Load the immutable workflow version.
- Validate runnable graph state.
- Create and update step-run records.
- Execute simple nodes directly.
- Publish `agent-task-requested`, `tool-call-requested`, and `notification-requested`.
- Resume execution when task-completed events arrive.
- Publish workflow completion or failure events.

## Key Rules

- Treat every Kafka event as possibly duplicated.
- Use `workflowRunId` and `nodeId` as idempotency keys.
- Persist state before publishing follow-up events.
- Respect retry limits and run timeout.

