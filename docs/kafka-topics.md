# Kafka Topics

Kafka is used for asynchronous workflow execution. Consumers must assume at-least-once delivery and use idempotency keys.

## Topics

| Topic | Producer | Consumer |
| --- | --- | --- |
| `workflow-triggered` | API | Workflow Worker |
| `workflow-step-started` | Workflow Worker | API/dashboard listeners |
| `workflow-step-completed` | Workers | Workflow Worker, API/dashboard listeners |
| `workflow-step-failed` | Workers | Workflow Worker, API/dashboard listeners |
| `agent-task-requested` | Workflow Worker | AI Worker |
| `agent-task-completed` | AI Worker | Workflow Worker |
| `tool-call-requested` | Workflow Worker | Tool Worker |
| `tool-call-completed` | Tool Worker | Workflow Worker |
| `human-approval-requested` | Workflow Worker | API/dashboard listeners |
| `notification-requested` | API/workers | Notification Worker |
| `workflow-completed` | Workflow Worker | API/dashboard listeners |
| `workflow-failed` | Workflow Worker | API/dashboard listeners |
| `dead-letter-events` | Any worker | Ops/debug tooling |

## Event Envelope

```json
{
  "eventId": "evt_123",
  "type": "workflow-triggered",
  "workspaceId": "ws_001",
  "workflowId": "wf_001",
  "workflowRunId": "run_001",
  "timestamp": "2026-06-06T10:00:00Z",
  "payload": {}
}
```

## Constraints

- Every event must include `eventId`, `type`, `workspaceId`, `workflowRunId`, and `timestamp`.
- Use `workflowRunId` plus node/task identifiers for idempotency.
- Retry failed handling up to 3 times before publishing to `dead-letter-events`.
- Commit consumer offsets only after durable state is written.
- Store enough event/run context to debug execution without leaking secrets.

