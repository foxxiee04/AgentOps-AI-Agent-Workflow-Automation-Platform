# Kafka Topics

Kafka is used for asynchronous workflow execution. Consumers must assume at-least-once delivery and use idempotency keys.

## Topics

| Topic | Producer | Consumer |
| --- | --- | --- |
| `workflow-triggered` | API | Workflow Worker |
| `workflow-step-started` | Workflow Worker | API/dashboard listeners |
| `workflow-step-completed` | Workers | Workflow Worker, API/dashboard listeners |
| `workflow-step-failed` | Workers (and dead-letter handling) | Workflow Worker, API/dashboard listeners |
| `agent-task-requested` | Workflow Worker | AI Worker |
| `agent-task-completed` | AI Worker | Workflow Worker |
| `tool-call-requested` | Workflow Worker | Tool Worker |
| `tool-call-completed` | Tool Worker | Workflow Worker |
| `human-approval-requested` | Workflow Worker | API/dashboard listeners |
| `human-approval-decided` | API | Workflow Worker |
| `notification-requested` | API/workers | Notification Worker |
| `workflow-completed` | Workflow Worker | API/dashboard listeners |
| `workflow-failed` | Workflow Worker | API/dashboard listeners |
| `dead-letter-events` | Any worker | Ops/debug tooling |

## Local Bootstrap

With Docker Compose running, create missing local topics with:

```bash
pnpm kafka:bootstrap
```

Defaults:

- Broker: `localhost:9094`
- Partitions: `3`
- Replication factor: `1`

Override with `KAFKA_BROKERS`, `KAFKA_TOPIC_PARTITIONS`, or `KAFKA_TOPIC_REPLICATION_FACTOR`.

## Event Envelope

```json
{
  "eventId": "evt_123",
  "type": "workflow-triggered",
  "workspaceId": "ws_001",
  "workflowId": "wf_001",
  "workflowRunId": "run_001",
  "requestId": "req_123",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "parentEventId": "evt_parent",
  "timestamp": "2026-06-06T10:00:00Z",
  "payload": {}
}
```

## Constraints

- Every event must include `eventId`, `type`, `workspaceId`, `workflowRunId`, and `timestamp`.
- Propagate `requestId`, `traceId`, `traceparent`, and `parentEventId` when an event is caused by another HTTP request or Kafka event.
- The API stores domain events in PostgreSQL before sending them to Kafka, then records `kafkaPublishedAt` or `kafkaError`.
- Use `workflowRunId` plus node/task identifiers for idempotency: `workflowRunId:nodeId:eventType`, recorded per consumer group in the `ProcessedMessage` table.
- Retry failed handling up to 3 times before publishing to `dead-letter-events` (implemented once in `processMessage`, used by every worker). A dead-lettered node also gets `workflow-step-failed`, which fails the run.
- Commit consumer offsets only after durable state is written.
- Store enough event/run context to debug execution without leaking secrets.

## Observability

The API exports Kafka consumer lag on `GET /metrics` as `agentops_kafka_consumer_lag{group_id,topic,partition}` for the main worker consumer groups:

- `agentops.workflow-worker` on `workflow-triggered`.
- `agentops.ai-worker` on `agent-task-requested`.
- `agentops.tool-worker` on `tool-call-requested`.
- `agentops.notification-worker` on `notification-requested`.

Each worker also exposes Prometheus metrics on its local metrics port and creates an OpenTelemetry consumer span around each Kafka message when OTel is enabled. Use `eventId`, `workflowRunId`, `requestId`, `traceId`, and `traceparent` together when debugging a workflow across API logs, Kafka messages, worker logs, and Tempo traces.
