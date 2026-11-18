# Kafka Topics

Kafka is the execution bus between the API and the four workers. PostgreSQL remains the source of truth for runs and steps; Kafka carries the events that move a run forward. Every message is a JSON `EventEnvelope` whose `type` is also the topic name.

The implementation lives in `packages/events`:

| File | Responsibility |
| --- | --- |
| `src/topics.ts` | The 14 topic names and 4 consumer group ids |
| `src/envelope.ts` | Zod envelope schema and event-type enum |
| `src/factory.ts` | `createEvent`, trace/parent propagation |
| `src/payloads.ts` | Zod schemas for the shared payloads |
| `src/consumer.ts` | `processMessage`: idempotency, retries, dead letters |
| `src/kafka-runner.ts` | Consumer startup, offset timing, graceful shutdown |
| `src/publisher.ts` | Batched producer keyed by `workflowRunId` |
| `scripts/bootstrap-topics.ts` | Creates missing topics and optionally adds partitions |

## Topics

`packages/events/src/topics.ts` defines 14 topics. All are used, but six have no consumer today; they are audit/history signals persisted by the producing worker and read from PostgreSQL where needed.

| Topic | Producer | Consumer group | Purpose |
| --- | --- | --- | --- |
| `workflow-triggered` | API | `agentops.workflow-worker` | Start a run from a published version |
| `workflow-step-started` | workflow-worker | none | Step moved to `RUNNING` or `WAITING_APPROVAL` |
| `workflow-step-completed` | workflow-worker | none | Step completed with output |
| `workflow-step-failed` | any worker (dead-letter path), workflow-worker (rejection) | `agentops.workflow-worker` | A node failed; fail the run |
| `agent-task-requested` | workflow-worker | `agentops.ai-worker` | Run an AI node |
| `agent-task-completed` | ai-worker | `agentops.workflow-worker` | AI output, token usage, validation result |
| `tool-call-requested` | workflow-worker | `agentops.tool-worker` | Run a mock tool node |
| `tool-call-completed` | tool-worker | `agentops.workflow-worker` | Mock tool result |
| `human-approval-requested` | workflow-worker | none | Approval row created; reviewer acts through the API |
| `human-approval-decided` | API | `agentops.workflow-worker` | Approve or reject, with optional edits |
| `notification-requested` | workflow-worker | `agentops.notification-worker` | Create an in-app notification / sales task |
| `workflow-completed` | workflow-worker | none | Run reached `END` |
| `workflow-failed` | workflow-worker | none | Run failed or was cancelled |
| `dead-letter-events` | any worker | none | Invalid, non-retryable, or exhausted message |

There is no API consumer and no dashboard consumer. The dashboard and the live run stream read PostgreSQL. `workflow-step-*`, `human-approval-requested`, `workflow-completed`, `workflow-failed`, and `dead-letter-events` are therefore history/ops topics, not commands. `dead-letter-events` is inspected with Kafka tooling and exported as a Prometheus gauge (`agentops_kafka_topic_messages{topic="dead-letter-events"}`).

## Consumer groups

| Group | Worker | Subscribed topics |
| --- | --- | --- |
| `agentops.workflow-worker` | workflow-worker | `workflow-triggered`, `agent-task-completed`, `tool-call-completed`, `human-approval-decided`, `workflow-step-failed` |
| `agentops.ai-worker` | ai-worker | `agent-task-requested` |
| `agentops.tool-worker` | tool-worker | `tool-call-requested` |
| `agentops.notification-worker` | notification-worker | `notification-requested` |

Each group is independent: the same topic can be read by several groups without sharing offsets. Consumer offsets are committed after `processMessage` returns, including the duplicate and dead-letter paths. A message is not considered handled until its database effects and outgoing events are done.

Every consumer subscribes with `fromBeginning: false`; a new group starts at the end of the topic.

## Event envelope

Every value is a JSON object validated by `eventEnvelopeSchema`.

| Field | Required | Constraint | Meaning |
| --- | --- | --- | --- |
| `eventId` | yes | non-empty string, `evt_<uuid>` | Unique event id |
| `type` | yes | one of the 14 topic names | Also the Kafka topic |
| `workspaceId` | yes | non-empty string | Tenant scope |
| `workflowId` | no | non-empty string | Present for workflow events |
| `workflowRunId` | yes | non-empty string, `run_<uuid>` | Run scope; also the Kafka message key |
| `requestId` | no | non-empty string | HTTP request that started the chain |
| `traceId` | no | 32 hex characters | W3C trace id |
| `traceparent` | no | `00-<32hex>-<16hex>-<2hex>` | W3C trace parent |
| `parentEventId` | no | non-empty string | The event that caused this one |
| `timestamp` | yes | ISO 8601 datetime | Creation time |
| `payload` | no | object, default `{}` | Type-specific body |

Example:

```json
{
  "eventId": "evt_5f0c8f3e-5a1e-4f6d-9f5e-2f0f0f0f0f0f",
  "type": "agent-task-requested",
  "workspaceId": "ws_demo",
  "workflowId": "wf_lead_qualification",
  "workflowRunId": "run_5d1c...",
  "requestId": "req_...",
  "traceId": "0123456789abcdef0123456789abcdef",
  "traceparent": "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
  "parentEventId": "evt_...",
  "timestamp": "2026-11-18T09:15:00.000Z",
  "payload": {
    "nodeId": "ai-1",
    "taskId": "aitask_run_5d1c..._ai-1",
    "input": { "name": "Anna Nguyen", "email": "anna@shopabc.vn", "message": "..." },
    "config": { "modelProvider": "mock", "outputSchema": { "type": "object" } },
    "definition": { "nodes": [], "edges": [] },
    "context": { "name": "Anna Nguyen" }
  }
}
```

Producer behavior differs slightly:

- API (`DomainEventsService.publishToKafka`): one `producer.send` per event, key `workflowRunId`, headers `eventId`, `requestId`, and `traceparent`. The row is written to `DomainEvent` first; the relay retries unpublished rows every 30 s.
- Workers (`packages/events/src/publisher.ts`): `sendBatch` with one batch per topic, key `workflowRunId`, value JSON. No headers. All events produced by one handled message go out in one round trip.

`createEvent` omits optional fields instead of setting them to `null`. `traceContextFromEvent` carries `requestId`, `traceId`, `traceparent`, and sets `parentEventId` to the source event id.

## Payload reference

### `workflow-triggered`

| Field | Type | Notes |
| --- | --- | --- |
| `input` | object | Validated lead input or arbitrary object |
| `triggerType` | `manual`, `webhook`, `scheduled`, `mock` | API passes `manual` by default |
| `workflowVersionId` | string | Pinned version |
| `definition` | object | Full `WorkflowDefinition` snapshot used by the worker |

### `workflow-step-started`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Step |
| `nodeType` | string | Node type |
| `status` | string, optional | `WAITING_APPROVAL` only for a paused approval |
| `input` | object, optional | Masked context for task nodes |

### `workflow-step-completed`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Step |
| `output` | object | Node output; `{ branch: [...] }` for a condition |

### `workflow-step-failed`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Failed step |
| `message` | string | Error, default `Step failed` |
| `attempts` | integer, optional | Delivery attempts before giving up |
| `output` | object, optional | Present on a rejection |
| `origin` | string, optional | `workflow-worker` for a rejection the worker already handled |

### `agent-task-requested`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | AI node |
| `taskId` | string | `aitask_<runId>_<nodeId>` |
| `input` | object | Full run context |
| `config` | object | AI node config |
| `definition` | object, optional | Workflow snapshot |
| `context` | object | Full run context |

### `agent-task-completed`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | AI node |
| `taskId` | string | Same id as the request |
| `output` | object | Validated JSON output |
| `tokenUsage` | `{ inputTokens, outputTokens }` | Defaults to zeros |
| `provider` | `mock` or `openai` | Default `mock` |
| `modelName` | string | Default `mock-lead-scorer` |
| `latencyMs` | integer | Measured by the AI worker |
| `validation` | `{ schemaValid, errors[] }` | Schema result |
| `definition` | object, optional | Workflow snapshot |
| `context` | object | Context carried through |

### `tool-call-requested`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Tool node |
| `toolCallId` | string | `tool_<runId>_<nodeId>` |
| `toolType` | `webhook`, `http_request`, `email_mock` | Lowercased node type |
| `input` | object | Context, or the email input for `EMAIL_MOCK` |
| `config` | object | Tool node config |
| `definition` | object, optional | Workflow snapshot |
| `context` | object | Full run context |

### `tool-call-completed`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Tool node |
| `toolCallId` | string | Same id as the request |
| `toolType` | string | Tool type |
| `status` | string | Always `mock_completed` today |
| `definition` | object, optional | Workflow snapshot |
| `context` | object | Context carried through |
| `output` | object | `{ mode: "mock", delivered: true, to, subject }` for email; `{ mode: "mock", delivered: true, url, method }` otherwise |

### `human-approval-requested`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Approval node |
| `title` | string | Node name |
| `review` | object | Masked `lead`, `assessment`, and drafted `email` |

### `human-approval-decided`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Approval node |
| `decision` | `approve` or `reject` | Reviewer decision |
| `comment` | string, optional | Mandatory for reject at the API, max 2000 |
| `decidedBy` | string | User id |
| `editedEmail` | `{ subject, body }`, optional | Present when the reviewer edited an approved email |
| `definition` | object | Workflow snapshot |
| `context` | object | Context at pause time |

### `notification-requested`

| Field | Type | Notes |
| --- | --- | --- |
| `nodeId` | string | Notification node |
| `kind` | string | Default `SALES_TASK` |
| `title` | string | Default node name |
| `body` | string | Lead summary, plus the rejection reason when applicable |
| `dueInHours` | number | Default 24 |

### `workflow-completed`

| Field | Type | Notes |
| --- | --- | --- |
| `completedAt` | ISO datetime | Completion time |

### `workflow-failed`

| Field | Type | Notes |
| --- | --- | --- |
| `message` | string | Failure reason |
| `status` | `FAILED` or `CANCELLED` | Rejection without a `rejected` edge uses `CANCELLED` |

### `dead-letter-events`

| Field | Type | Notes |
| --- | --- | --- |
| `originalTopic` | string | Topic of the failed message |
| `consumerGroup` | string | Group that failed |
| `reason` | `invalid_envelope`, `non_retryable`, `retries_exhausted` | Failure class |
| `attempts` | integer | 0 for an invalid envelope |
| `error` | string | Error message |
| `originalEvent` | object, optional | Parsed event that failed |
| `rawValue` | string, optional | First 4000 characters when the envelope itself was invalid |

## Idempotency

`idempotencyKeyFor(event)` returns:

```text
<workflowRunId>:<nodeId>:<eventType>
```

`nodeId` comes from `payload.nodeId`; messages without one use the literal `run`, for example `run_123:run:workflow-triggered`.

`ProcessedMessage` has a unique constraint on `(consumerGroup, idempotencyKey)`. Before handling, `processMessage` checks whether the key exists for that group. If it does, the message is returned as `duplicate` and the offset is committed.

Consequences:

- A redelivered message does not re-run the handler. A redelivery with a new `eventId` is still a duplicate, because the key does not include `eventId`.
- Different consumer groups have independent idempotency, so the same event can be handled once by each interested group.
- The DB writes are also replay-safe: run/step writes are upserts or guarded updates, and approvals use `upsert` with an empty update.
- The key does not include the source event id, so two legitimate events of the same type for the same node and run collide. The engine is designed so that does not happen on a linear path; see the fan-out warning in [workflow-engine.md](workflow-engine.md).

`ProcessedMessage` grows without a pruning job in this repository. For a long-lived deployment, add a retention policy.

## Retries and dead letters

`processMessage` defaults:

| Setting | Value |
| --- | --- |
| Max attempts | 3 (`DEFAULT_MAX_ATTEMPTS`) |
| Backoff | `200 * 2^(attempt-1)` ms: 200 ms after attempt 1, 400 ms after attempt 2 |
| Non-retryable | `NonRetryableError` subclasses skip the remaining attempts |
| Commit | After processed, duplicate, or dead-lettered |

On the final failure it publishes to `dead-letter-events` with the reason and error. If the failed event carries a `nodeId` and is not already `workflow-step-failed`, it also publishes `workflow-step-failed` with `{ nodeId, message, attempts }`. The workflow worker consumes that and fails the run. Messages without a `nodeId` (for example a malformed `workflow-triggered`) produce only the dead letter; there is no step to mark failed.

A published dead letter or step failure is not retried by the consumer; the message is considered handled and the offset is committed. Replay is a manual operation: copy the `originalEvent` back to its original topic (with a new `eventId` if you want it processed despite idempotency) or fix the cause and start a new run.

Failure sources that reach the dead-letter path:

- AI output still invalid after the node's `retryLimit` (`AiOutputValidationError`, non-retryable).
- AI daily quota exhausted (`AiQuotaExceededError`, non-retryable).
- OpenAI selected without `OPENAI_API_KEY` (non-retryable).
- Database errors, malformed payloads, or unexpected handler exceptions (retried).
- Invalid envelope JSON or schema (dead letter with `attempts: 0`).

The tool worker normally does not throw: an unsupported HTTP method returns a `workflow-step-failed` event from the handler, and the original message is marked processed.

## Ordering and partitioning

- The message key is always `workflowRunId`. All events for one run go to one partition, so their relative order is preserved within the topic.
- There is no global ordering across topics. A run's `workflow-triggered`, then `agent-task-requested`, then `agent-task-completed` are on different topics and can interleave with other runs.
- Within a worker, `partitionsConsumedConcurrently` defaults to 3. Each partition is processed sequentially; different partitions can be processed in parallel.
- A consumer group can use at most one consumer per partition. Extra pods beyond the partition count stay idle. This is why prod raises topics to 6 partitions before scaling workers to 6.

Topic configuration comes from the bootstrap job, not from application code:

| Environment | Partitions | Replication | Command |
| --- | --- | --- | --- |
| Local | 3 | 1 | `pnpm kafka:bootstrap` (also run by `docker-compose.apps.yml` setup) |
| Production | 6 | 2 | Kubernetes setup job with `KAFKA_TOPIC_PARTITIONS=6`, `KAFKA_TOPIC_REPLICATION_FACTOR=2` |

The bootstrap script:

1. Lists existing topics.
2. Creates every topic in `kafkaTopics` that is missing, with the configured partitions and replication factor.
3. If `KAFKA_TOPIC_ALLOW_INCREASE=true`, adds partitions to existing topics that have fewer than configured. It never decreases partitions.

It does not set retention, cleanup policy, or min in-sync replicas. Those are broker defaults or MSK configuration.

## Local commands

```bash
# Create missing topics (KAFKA_BROKERS defaults to localhost:9094)
pnpm kafka:bootstrap

# Inspect topics and groups (Kafka CLI inside the broker container)
docker exec -it agentops-local-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

docker exec -it agentops-local-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group agentops.workflow-worker

# Read the dead-letter topic
docker exec -it agentops-local-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic dead-letter-events --from-beginning
```

In production, use MSK tooling or a temporary pod with the Kafka CLI and the MSK bootstrap brokers. The API does not expose a Kafka proxy.

## Trace propagation

- The API writes `traceId` and `traceparent` into the envelope and as headers.
- Every worker event created from a source event inherits the trace context and sets `parentEventId` to the source `eventId`.
- The consumer instrumentation starts a `kafka consume <topic>` CONSUMER span from the envelope's `traceparent`/`traceId`, then rewrites the envelope passed to the handler with the consumer span's trace id and a new `traceparent`. Events published by the handler therefore become children of the consumer span in Tempo.
- The workflow worker adds a `workflow.node <TYPE>` span per started step; the AI worker adds an `ai.call` span.

See [observability.md](observability.md) for the trace query examples and the full signal map.

## Current limitations

- No Schema Registry. The envelope and payloads are Zod-validated JSON; there is no compatibility check at produce time.
- No consumer for the six history topics. They are written and retained but only inspected by tooling; the UI reads PostgreSQL.
- No DLQ replay tool, retention job, or alert on `ProcessedMessage` growth.
- No transactional producer. The outbox and idempotent consumers provide the at-least-once guarantee; there is no Kafka transaction spanning the database write.
- No per-topic retention policy in the repository.
- Message values are not compressed by application code; broker defaults apply.
