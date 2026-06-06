# Technology Decisions

This document records the current technology choices for AgentOps and notes recommended additions.

## Confirmed Core Stack

| Area | Choice | Current Scaffold Version | Reason |
| --- | --- | --- | --- |
| Monorepo | pnpm workspace + Turborepo | pnpm 11.5.2, Turbo 2.9.x | Fast task orchestration across apps/packages. |
| Frontend | Next.js App Router + React | Next 16.2.7, React 19.2.7 | SaaS landing, dashboard, and app routing in one project. |
| Workflow canvas | `@xyflow/react` | 12.11.0 | Modern React Flow package for node/edge builders. |
| Backend | NestJS modular monolith | 11.1.24 | Strong module boundaries without microservice overhead. |
| Database ORM | Prisma ORM | 7.8.0 | Type-safe schema/migrations with PostgreSQL. |
| Database | PostgreSQL | Docker image 16 | Durable workflow, run, usage, audit, and workspace data. |
| Cache/status | Redis | Docker image 7 | Cache, rate limit, run status, and future lightweight locks. |
| Event pipeline | Kafka + KafkaJS | Apache Kafka Docker image 4.3.0, KafkaJS 2.2.4 | Async workflow execution and worker coordination. |
| Validation | Zod + class-validator | Zod 4.4.3 | Zod for shared schemas, class-validator for Nest DTOs. |
| AI provider | OpenAI SDK first | OpenAI 6.42.0 | Structured output support and mature Node SDK. |
| Tests | Vitest | 4.1.8 | Fast unit tests for packages, workers, and domain logic. |
| Logging | Pino/Nest Logger | Pino 10.3.1 | Worker-friendly structured logging. |
| Security basics | Helmet + Throttler + argon2 | current npm versions | API hardening, rate limiting, password hashing path. |

## Prisma 7 Notes

Prisma 7 changed the setup from older examples:

- Connection URLs live in `prisma.config.ts`, not in `schema.prisma`.
- `generator client` uses `provider = "prisma-client"` and requires an `output`.
- The generated client is imported from the configured output path.
- Direct database usage should use a driver adapter, so the scaffold includes `@prisma/adapter-pg`.

This repo follows that structure in `packages/database`.

## Recommended Additions

Add these when the relevant feature becomes real:

| Technology | When To Add | Why |
| --- | --- | --- |
| Playwright | After core UI flows exist | End-to-end tests for auth, builder, publish, and run history. |
| OpenTelemetry | When API/workers are wired to Kafka/DB | Correlation across HTTP requests, Kafka events, and workflow runs. |
| Prometheus client | When Kubernetes deploy starts | Export metrics such as runs, failures, step duration, token usage. |
| Testcontainers | When integration tests need real PostgreSQL/Kafka | Reliable local integration tests without hand-managed services. |
| Sentry or similar | After public demo deployment | Error tracking for frontend and backend. |
| `@google/generative-ai` | If Gemini is selected as second provider | Keep provider abstraction small and add Gemini only when used. |
| pgvector | After AI memory/search scope is approved | Useful for agent memory and template retrieval, not needed in MVP. |

## Technologies To Avoid In MVP

- Full microservices: conflicts with the intentional modular monolith design.
- Temporal: powerful, but too much operational surface for the first MVP because Kafka workers already prove async execution.
- BullMQ as a second queue: Redis should remain cache/status/rate-limit until a clear non-Kafka queue use case appears.
- A separate BFF service: Next.js and NestJS are enough for the current architecture.
