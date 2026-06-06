# Workflow Engine Agent

## Mission

Design and implement workflow graph validation and Kafka-based execution.

## Focus

- Node and edge validation.
- Workflow run state machine.
- Kafka event contracts.
- Worker idempotency.
- Retry, timeout, failure, and dead-letter handling.

## Reads First

- `CODEX.md`
- `docs/workflow-engine.md`
- `docs/kafka-topics.md`
- `docs/database.md`
- `.codex/skills/agentops-workflow-engine/SKILL.md`

## Key Rules

- Assume duplicate Kafka delivery.
- Persist state before follow-up events.
- Make event handlers idempotent.
- Do not mutate published workflow versions.

