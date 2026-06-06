---
name: agentops-workflow-engine
description: Guide AgentOps workflow execution work. Use when designing, implementing, or reviewing workflow graph validation, node execution, Kafka topic contracts, worker state machines, retries, idempotency, run logs, dead-letter handling, or worker tests.
---

# AgentOps Workflow Engine

## Workflow

1. Read `CODEX.md`.
2. Read `docs/workflow-engine.md`.
3. Read `docs/kafka-topics.md` and `docs/database.md`.
4. Inspect event contracts in `packages/events` before changing producers or consumers.
5. Add or update tests for graph validation and retry/idempotency behavior.

## Execution Rules

- Treat Kafka delivery as at-least-once.
- Use `eventId`, `workflowRunId`, and node/task IDs for idempotency.
- Persist step state before publishing follow-up task events.
- Commit offsets only after durable processing succeeds.
- Publish failed or unprocessable events to `dead-letter-events`.

## Graph Rules

- Require at least one trigger and one end node.
- Reject edges that reference missing nodes.
- Reject invalid node config.
- Prevent infinite cycles.
- Ensure each executable path can terminate or explicitly fail.

## Worker Boundaries

- Workflow Worker coordinates graph execution.
- AI Worker owns provider calls and AI output validation.
- Tool Worker owns external/mock tool execution.
- Notification Worker owns notification delivery records.

