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

The architecture is intentionally **Modular Monolith + Kafka Workers**, not full microservices. Core business logic stays in one well-structured NestJS API, while heavy asynchronous work runs through Kafka workers.

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
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, React Flow, TanStack Query, Zustand, React Hook Form, Zod |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL, Redis, Kafka, JWT, Swagger/OpenAPI, Jest |
| AI | OpenAI or Gemini API, structured JSON output, prompt templates, optional pgvector |
| Infrastructure | Docker, Kubernetes, Terraform, Nginx Ingress, GitHub Actions |

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

## Codex Usage

Before asking Codex to implement features in this repo, start from [CODEX.md](CODEX.md). It defines the project invariants, required reading order, skill map, and definition of done for future coding tasks.

## API Smoke Tests

Postman files live in `postman/`:

- `AgentOps.postman_collection.json`
- `AgentOps.local.postman_environment.json`

Import both files, select the `AgentOps Local` environment, start the API on `http://localhost:4000`, then run the collection in order.

## External Structure References

This scaffold follows current official guidance from Turborepo workspace structure, Next.js App Router project structure, NestJS workspace/module organization, Kafka delivery semantics, Kubernetes workload resources, Terraform module structure, and GitHub Actions workflow syntax.
