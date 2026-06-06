# Agent Guide

The `agents/` folder defines operating profiles for the major responsibilities in AgentOps.

| Agent | Use For |
| --- | --- |
| Product Architect | Scope, roadmap, architecture decisions, interview story |
| Frontend Agent | Next.js UI, landing, dashboard, React Flow builder |
| Backend Agent | NestJS API, Prisma, auth, workspace, workflow modules |
| Workflow Engine Agent | Graph validation, Kafka execution, retries, idempotency |
| AI Agent | AI nodes, prompts, schemas, provider calls, token usage |
| DevOps Agent | Docker, Kubernetes, Terraform, CI/CD, observability |
| QA Agent | Review, tests, security, regression risk |

## How To Use

1. Read `CODEX.md`.
2. Pick the agent profile that matches the task.
3. Read the linked docs in that profile.
4. Use the matching project skill from `.codex/skills/`.

These files are intentionally short. The detailed project rules live in `CODEX.md` and `docs/`.

