# AgentOps — AI Agent Workflow Automation Platform

AgentOps is an AI-native SaaS platform for building, running, and monitoring automated workflows powered by AI agents. It is designed as a portfolio-grade system that combines a modern Next.js dashboard, a NestJS modular monolith, Kafka-based worker execution, PostgreSQL persistence, Redis state/cache, and cloud-ready infrastructure.

## Product Vision

Users can design workflows with a visual builder:

```txt
New lead submitted
-> AI scores the lead
-> If score > 80
-> Generate a personalized email
-> Send a webhook/email mock
-> Create a follow-up task
-> Store run history and logs
```

The architecture is intentionally **Modular Monolith + Kafka Workers**, not full microservices. Frontend and backend are already separate deployable apps (`apps/web` and `apps/api`), while core backend business logic stays in one well-structured NestJS API. Heavy asynchronous work runs through Kafka workers.

## MVP Scope

- Landing page and SaaS dashboard
- Auth, workspace, and role-based access control
- Workflow list and visual workflow builder
- Manual trigger, AI Agent node, Condition node, Webhook mock node, End node
- Workflow run history and step logs
- Kafka event pipeline for workflow execution
- AI worker with structured JSON output validation
- PostgreSQL persistence and Redis status/cache
- Docker Compose for local infrastructure
- Kubernetes manifests, Terraform layout, and GitHub Actions plan

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, `apps/web/DESIGN.md` terminal-native UI rules, React Flow, Zustand, React Hook Form, Zod |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL, Redis, Kafka, JWT, Swagger/OpenAPI, Vitest |
| AI | OpenAI Responses API path, mock provider, structured JSON output, prompt templates, JSON Schema validation, optional pgvector |
| Infrastructure | Docker, Kubernetes, Terraform, AWS ECR, Nginx Ingress, GitHub Actions |

See [docs/technology-decisions.md](docs/technology-decisions.md) for current package choices, Prisma 7 notes, and recommended additions such as Playwright, OpenTelemetry, Prometheus, Testcontainers, and Sentry.

## Repository Map

```txt
apps/
  web/                  Next.js landing page and dashboard
  api/                  NestJS modular monolith API
  workflow-worker/      Executes workflow graphs and coordinates steps
  ai-worker/            Executes AI Agent node tasks
  tool-worker/          Executes webhook/http/email mock tool calls
  notification-worker/  Creates in-app notifications and mock messages
packages/
  shared/               Shared types, constants, validation schemas
  ui/                   Shared UI components for the web app
  config/               Shared TypeScript, lint, env, and runtime config
  database/             Prisma schema, migrations, seed plan
  events/               Kafka event contracts and topic helpers
infrastructure/
  docker/               Local container notes and Dockerfile plan
  k8s/                  Kubernetes manifests and environment overlays
  terraform/            Cloud infrastructure modules and environments
  observability/        Metrics, logging, dashboards, and tracing notes
docs/                   Architecture, API, Kafka, database, AI, security, deployment docs
agents/                 Human/Codex agent role descriptions
.codex/skills/          Project-local Codex skills
```

## Runtime Naming

Use one naming style across local Docker, Kubernetes, and AWS:

| Resource | Pattern | Example |
| --- | --- | --- |
| Local container | `agentops-local-<service>` | `agentops-local-postgres` |
| Local volume | `agentops_local_<service>_data` | `agentops_local_postgres_data` |
| Local network | `agentops_local_net` | `agentops_local_net` |
| Local app image | `agentops/<app>:local` | `agentops/api:local` |
| AWS ECR repository | `<env-name>/<app>` | `agentops-dev/api` |
| Kubernetes namespace | `agentops` | `agentops` |

Useful commands:

```bash
pnpm compose:up
pnpm db:push
pnpm kafka:bootstrap
pnpm docker:build:apps
```

## Workers And Monolith

There are four workers because the MVP has four async execution domains:

- `workflow-worker`: graph execution and run coordination.
- `ai-worker`: prompt building, provider calls, structured output validation.
- `tool-worker`: webhook/http/email mock action execution.
- `notification-worker`: notification creation and mock delivery.

Add more workers only when a new domain needs different scaling, retries, security, or runtime dependencies. The backend stays a modular monolith because auth, workspaces, workflow versions, RBAC, usage, and audit rules share the same domain model and database transactions.

## Codex Usage

Before asking Codex or another AI agent to implement features in this repo, start from [.codex/CODEX.md](.codex/CODEX.md). Root [CODEX.md](CODEX.md) is only a pointer.

For UI work, also read [apps/web/DESIGN.md](apps/web/DESIGN.md). It was installed with:

```bash
npx getdesign@latest add opencode.ai
```

The current web app follows that design direction: mono typography, warm cream canvas, hairline borders, 4px-radius controls, ASCII markers, no gradients, and no card shadows. Server pages read live data from the NestJS API through `apps/web/src/lib/api.ts` and fall back to stable demo data only when the API is offline.

## API Smoke Tests

Postman files live in `postman/`:

- `AgentOps.postman_collection.json`
- `AgentOps.local.postman_environment.json`

Import both files, select the `AgentOps Local` environment, start the API on `http://localhost:4000`, then run the collection in order.

## External Structure References

This scaffold follows current official guidance from Turborepo workspace structure, Next.js App Router project structure, NestJS workspace/module organization, Kafka delivery semantics, Kubernetes workload resources, Terraform module structure, and GitHub Actions workflow syntax.
