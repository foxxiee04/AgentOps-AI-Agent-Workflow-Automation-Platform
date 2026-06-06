---
name: agentops-review
description: Guide AgentOps review work. Use when reviewing code, docs, architecture, tests, security, workflow execution behavior, Kafka idempotency, AI validation, RBAC, infrastructure, or readiness before merging/deploying AgentOps changes.
---

# AgentOps Review

## Workflow

1. Read `CODEX.md`.
2. Read the docs that match the changed area.
3. Inspect changed files and nearby tests.
4. Lead with findings ordered by severity.
5. Mention missing tests or residual risk.

## Review Checklist

- Architecture still follows Modular Monolith + Kafka Workers.
- Workspace-scoped behavior enforces RBAC.
- Workflow versions remain immutable.
- Kafka handlers are idempotent.
- Failed events have retry and dead-letter behavior.
- AI output is schema validated.
- Secrets and unnecessary PII are not exposed.
- Docs and README files still match the code.

## Testing Expectations

Prioritize tests for:

- Graph validation.
- Permission boundaries.
- Event publishing/consuming.
- Retry and failure paths.
- AI malformed output.
- API validation.

