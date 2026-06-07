# AgentOps Codex Operating Manual

Read this file before any coding, review, architecture, documentation, debugging, DevOps, or AI task in this repository.

## Reading Order

1. Read `.codex/CODEX.md`.
2. Read `README.md`.
3. For UI work, read `apps/web/DESIGN.md`.
4. Read the relevant doc in `docs/`.
5. Read the matching local skill in `.codex/skills/`.
6. Inspect existing files before editing.

## System Shape

AgentOps is an AI workflow automation SaaS.

Architecture:

```txt
apps/web              Next.js frontend
apps/api              NestJS modular monolith backend
Kafka topics          async workflow/task events
apps/*-worker         async execution specialists
PostgreSQL            durable data
Redis                 cache/status/rate-limit support
Kubernetes/Terraform  AWS-ready deployment
```

Use **Modular Monolith + Kafka Workers**. Do not split core backend modules into microservices unless explicitly requested.

## Why This Architecture

- Frontend and backend are already separate deployable apps under `apps/web` and `apps/api`.
- Backend business rules stay in one NestJS modular monolith to avoid premature microservice complexity.
- Workers are separate deployable apps because workflow execution, AI calls, tools, and notifications are slow/async/retryable.
- Kafka gives at-least-once delivery, backpressure, worker scaling, and clear event contracts without turning every domain module into a service.

## Worker Responsibilities

- `workflow-worker`: consumes workflow triggers, executes graph steps, coordinates run state, publishes task events.
- `ai-worker`: executes AI Agent tasks, builds prompts, calls providers, validates JSON output, tracks token metadata.
- `tool-worker`: executes webhook/http/email mock tool calls with timeout and retry constraints.
- `notification-worker`: creates in-app notifications and mock delivery events.

Add a new worker only when a new async domain has different scaling, retry, security, or runtime needs.

## API Boundary

Keep route groups stable during MVP:

```txt
/health
/auth
/workspaces
/workflows
/workflow-runs
/ai
/webhooks
/dashboard
/notifications
/audit
```

The API currently uses:

- Helmet
- CORS
- global validation pipe
- throttling
- request ID middleware
- request logging middleware
- HTTP exception filter
- Terminus readiness/liveness checks

Do not introduce `/api/v1` or another global prefix without updating frontend, Postman, docs, and smoke tests.

## Naming Convention

Local Docker:

- containers: `agentops-local-<service>`
- volumes: `agentops_local_<service>_data`
- network: `agentops_local_net`
- app images: `agentops/<app>:local`

AWS:

- ECR repositories: `<env-name>/<app>`
- Kubernetes namespace: `agentops`
- Kubernetes workloads/services: `agentops-api`, `agentops-web`, `<domain>-worker`, `postgres`, `redis`, `kafka`

## Code Rules

- Use TypeScript across apps/packages.
- Keep shared contracts in `packages/shared` and `packages/events`.
- Keep Prisma/database assets in `packages/database`.
- For frontend UI, use `apps/web/DESIGN.md` as the reference. The implemented app is terminal-inspired but optimized for readability: sans-serif body text, mono for code/terminal/JSON, warm cream canvas, high-contrast text, hairline borders, 4px interactive radius, ASCII markers, no gradients or shadows.
- Frontend pages should call the NestJS API through `apps/web/src/lib/api.ts` and use explicit fallback data only to keep builds and demos resilient when the API is offline.
- Validate all user input and all AI output.
- Treat workflow versions as immutable once published.
- Treat Kafka handlers as at-least-once processors and make them idempotent.
- Do not send secrets, env values, private tokens, or unnecessary PII to AI providers.
- Store enough metadata for debugging without leaking sensitive prompt content.

## Definition Of Done

A task is done only when:

- It follows the architecture and MVP scope.
- Docs/README/Postman stay accurate when behavior changes.
- Relevant tests, typecheck, build, or manual smoke checks were run.
- Security, workspace authorization, AI validation, and dependency readiness were considered.
- No unrelated user changes were reverted.

## Key Docs

- `docs/architecture.md`
- `docs/api.md`
- `docs/ai-agent.md`
- `docs/workflow-engine.md`
- `docs/kafka-topics.md`
- `docs/database.md`
- `docs/security.md`
- `docs/deployment.md`
- `docs/aws-kubernetes-deployment.md`
- `docs/technology-decisions.md`

## Local Skills

- `.codex/skills/agentops-context`
- `.codex/skills/agentops-frontend`
- `.codex/skills/agentops-backend`
- `.codex/skills/agentops-workflow-engine`
- `.codex/skills/agentops-ai-integration`
- `.codex/skills/agentops-devops`
- `.codex/skills/agentops-review`
