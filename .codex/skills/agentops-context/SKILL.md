---
name: agentops-context
description: Load AgentOps project context and repository operating rules. Use when Codex works on any task in this AgentOps repo, including architecture, docs, frontend, backend, workflows, AI integration, DevOps, testing, security, or code review.
---

# AgentOps Context

## Workflow

1. Read `CODEX.md`.
2. Read `README.md`.
3. Read the relevant document in `docs/`.
4. Inspect the target files before editing.
5. Preserve the Modular Monolith + Kafka Workers architecture.
6. Keep documentation accurate when structure, behavior, or scope changes.

## Core Invariants

- Keep deployable apps under `apps/`.
- Keep shared contracts under `packages/`.
- Keep infrastructure under `infrastructure/`.
- Keep project role guides under `agents/`.
- Treat published workflow versions as immutable.
- Treat Kafka consumers as at-least-once processors.
- Validate all user input and AI output.

## Useful Entry Points

- Architecture: `docs/architecture.md`
- API: `docs/api.md`
- Workflow execution: `docs/workflow-engine.md`
- Kafka: `docs/kafka-topics.md`
- Database: `docs/database.md`
- AI: `docs/ai-agent.md`
- Security: `docs/security.md`
- Deployment: `docs/deployment.md`

