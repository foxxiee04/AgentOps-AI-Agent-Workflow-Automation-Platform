# CODEX.md

This file is the operating manual for Codex when working on AgentOps. For every future coding, review, architecture, documentation, or debugging request in this repository, read this file first, then read the linked docs that match the task.

## Required Reading Order

1. Read `CODEX.md`.
2. Read `README.md` for product and repository orientation.
3. Read the relevant domain doc in `docs/`.
4. Read the matching project skill under `.codex/skills/` when the task touches frontend, backend, workflow execution, AI, DevOps, or review.
5. Inspect existing files before editing. Preserve user changes and avoid unrelated refactors.

## Project Identity

AgentOps is a portfolio-grade AI workflow automation SaaS:

- Visual workflow builder for business automations.
- AI Agent nodes that return structured JSON.
- Modular NestJS backend for core product logic.
- Kafka workers for asynchronous execution.
- PostgreSQL for durable data and Redis for cache/status/rate limits.
- Kubernetes and Terraform for cloud-ready deployment.

## Non-Negotiable Architecture

- Use **Modular Monolith + Kafka Workers**.
- Do not split core backend modules into full microservices unless explicitly requested.
- Keep deployable apps flat under `apps/` for monorepo tooling compatibility.
- Keep shared contracts in `packages/`, especially event schemas and validation types.
- Treat workflow versions as immutable once published.
- Treat Kafka consumers as at-least-once processors; make handlers idempotent.
- Validate all user input and all AI output.
- Do not send secrets, private env values, or unnecessary PII to AI providers.

## Product Modules

- Auth and workspace management
- Workflow builder and workflow publishing
- Workflow run execution and run logs
- AI Agent config, AI task execution, and usage tracking
- Webhook/API mock integrations
- Notifications and audit logs
- Dashboard metrics and recent activity

## Worker Responsibilities

- `workflow-worker`: consume workflow trigger events, execute graph steps, persist run state, publish task events.
- `ai-worker`: consume AI task events, build prompts, call provider, validate JSON, store token usage.
- `tool-worker`: execute webhook/http/email mock actions with timeout and retry limits.
- `notification-worker`: create in-app notifications and optional mock email records.

## MVP Boundaries

Build the MVP before advanced features:

- Manual trigger first; public webhook trigger later.
- AI Agent, Condition, Webhook Mock, and End nodes first.
- Human approval, version diff UI, marketplace, pgvector memory, billing, and advanced observability later.
- Docker Compose local infrastructure before Kubernetes production polish.

## Coding Standards

- Use TypeScript across apps and packages.
- Prefer Zod or class-validator DTO validation at boundaries.
- Keep backend modules cohesive: controller, service, repository/data access, DTOs, policies, tests.
- Keep frontend feature logic colocated under `apps/web/src/features`.
- Keep presentational reusable components in `packages/ui` once reuse is real.
- Use structured logging with correlation IDs for API requests, workflow runs, and Kafka events.
- Add tests where behavior can regress: graph validation, permissions, event handling, AI output validation, and retry paths.

## Security Rules

- Hash passwords with argon2 or bcrypt.
- Use short-lived JWT access tokens and refresh-token rotation.
- Enforce workspace RBAC on every workspace-scoped endpoint.
- Rate-limit auth, workflow runs, webhook triggers, and AI calls.
- Block or tightly validate risky outbound URLs for webhook/http nodes.
- Mask or avoid storing sensitive prompt content unless privacy settings allow it.

## Definition Of Done

A change is done only when:

- It fits the architecture and MVP scope.
- Relevant docs or README files stay accurate.
- Validation, tests, or a clear manual verification path is provided.
- Security and workspace authorization concerns have been considered.
- No unrelated files were modified.

## Project Skills

- `.codex/skills/agentops-context`: use for any AgentOps task to load project context.
- `.codex/skills/agentops-frontend`: use for Next.js dashboard, landing, and workflow builder work.
- `.codex/skills/agentops-backend`: use for NestJS API, Prisma, auth, workspace, and modules.
- `.codex/skills/agentops-workflow-engine`: use for workflow graph execution, Kafka topics, retries, and idempotency.
- `.codex/skills/agentops-ai-integration`: use for AI Agent nodes, prompts, schemas, provider calls, and token usage.
- `.codex/skills/agentops-devops`: use for Docker, Kubernetes, Terraform, CI/CD, and observability.
- `.codex/skills/agentops-review`: use for code review, test coverage, security, and architecture consistency checks.

## Useful Docs

- `docs/architecture.md`
- `docs/workflow-engine.md`
- `docs/kafka-topics.md`
- `docs/api.md`
- `docs/database.md`
- `docs/ai-agent.md`
- `docs/security.md`
- `docs/deployment.md`
- `docs/agents.md`
- `docs/skills.md`

