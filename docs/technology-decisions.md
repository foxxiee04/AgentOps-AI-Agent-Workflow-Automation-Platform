# Architecture Decision Records (ADRs)

This document records the confirmed core technology stack and architectural decisions governing the AgentOps platform.

---

## Confirmed Core Stack

| Layer | Technology | Current Version | Primary Rationale |
| --- | --- | --- | --- |
| **Monorepo** | pnpm workspaces + Turborepo | pnpm 11.5.2, Turbo 2.5.x | High-throughput dependency caching and monorepo task orchestration. |
| **Web Frontend** | Next.js (App Router) + React | Next.js 16.4.2, React 19.2.7 | Unified server-side rendering, metadata streaming, and API client routes. |
| **Styling & Motion** | Tailwind CSS 4 + Motion | Tailwind 4.3.0, Motion 14.5.0 | CSS variable-driven token architecture and physics-based UI transitions. |
| **3D Graphics** | Three.js + React Three Fiber | Three 0.164.0, R3F 9.0.0, Drei 10.0.0 | High-performance WebGL interactive sculpture on landing page. |
| **Workflow Canvas** | `@xyflow/react` | 12.11.0 | Specialized directed graph builder with custom node types and edge labels. |
| **API Backend** | NestJS modular monolith | 11.2.7 | Strong domain boundary isolation without distributed microservice overhead. |
| **Database ORM** | Prisma 7 + `@prisma/adapter-pg` | 7.10.1 | Type-safe schema migrations with PostgreSQL 16 driver adapter. |
| **Persistence** | PostgreSQL | 16 (Docker & AWS RDS) | Relational integrity for workflows, versions, runs, audit logs, and users. |
| **In-Memory Cache** | Redis | 7 (Docker & AWS ElastiCache) | Session caching and cluster readiness checks. |
| **Event Pipeline** | Apache Kafka + KafkaJS | Kafka 3.9 / 4.3, KafkaJS 2.2.4 | Asynchronous execution plane connecting API to worker pools. |
| **Schema Validation** | Zod + AJV | Zod 4.4.3, AJV 8.20.0 | Zod for internal contracts; AJV for strict JSON Schema output validation. |
| **AI Inference** | OpenAI SDK + Responses API | OpenAI 6.42.0 | Structured output enforcement via `gpt-4o-mini` with deterministic mock fallback. |
| **Observability** | Prometheus, Alertmanager, Grafana, Tempo | OTel SDK 0.218.0 | Full telemetry: 17 alert rules, 5 dashboards, and distributed OTLP tracing. |
| **Unit & E2E Testing** | Vitest + Playwright | Vitest 4.1.8, Playwright 1.60.0 | Fast domain testing and full end-to-end browser user journey validation. |

---

## Architectural Decision Records

### ADR-01: Modular Monolith vs. Distributed Microservices
- **Status:** Accepted
- **Context:** AgentOps requires clear domain boundaries across auth, workspace isolation, workflow definitions, and platform audit logging. Microservice architectures introduce operational latency, network partitions, and complex distributed transactions.
- **Decision:** Build `apps/api` as a single NestJS modular monolith sharing a relational PostgreSQL database.
- **Consequences:** Developers navigate a single codebase with unified compile-time typing. Operational complexity is deferred to asynchronous Kafka worker processes rather than synchronous HTTP service meshes.

### ADR-02: Asynchronous Execution via Kafka & Idempotent Workers
- **Status:** Accepted
- **Context:** Workflow runs may take minutes to execute due to model latency, retry policies, or human review delays. Running workflows within synchronous HTTP requests would cause request timeouts.
- **Decision:** Split the platform into a synchronous HTTP control plane (API) and an asynchronous execution plane (4 Kafka worker services: `workflow-worker`, `ai-worker`, `tool-worker`, `notification-worker`).
- **Consequences:** Delivery across Kafka is at-least-once. Handlers must be idempotent; every worker transaction deduplicates events using the `ProcessedMessage` store before executing business logic.

### ADR-03: Prisma 7 Driver Adapter with PostgreSQL
- **Status:** Accepted
- **Context:** Prisma 7 redesigned database connection handling, deprecating legacy connection strings in `schema.prisma`.
- **Decision:** Adopt Prisma 7.10 using `@prisma/adapter-pg` and the standard `pg` driver adapter. Database configurations are centralized in `prisma.config.ts`.
- **Consequences:** Ensures direct, efficient connection pooling compatible with AWS RDS PostgreSQL and local Docker environments.

### ADR-04: Moss Atelier Visual System & Playfair Display for Vietnamese Typography
- **Status:** Accepted (2026-11-17)
- **Context:** The initial "Lumen" design direction was replaced by the owner with the "Moss Atelier" direction (selected from MotionSites templates "Agent Hero" and "Moss Island"). The typography required support for English and Vietnamese diacritics. Instrument Serif was evaluated but lacked complete Vietnamese glyphs.
- **Decision:** Implement the Moss Atelier aesthetic: warm stone canvas (`#F4F3EF`), ink-green typography (`#0F1A14`), moss accent (`#2F5D3A`), and live lime accents (`#C6F35C`). Select **Playfair Display** (latin, latin-ext, vietnamese subsets) for display headlines, **Inter Tight** for UI/body copy, and **JetBrains Mono** for data and identifiers.
- **Consequences:** Cohesive editorial control-room look meeting WCAG AA contrast standards, with native typography rendering in both English and Vietnamese.

### ADR-05: Client-Only React Three Fiber WebGL Hero Sculpture
- **Status:** Accepted
- **Context:** The landing page features an interactive 3D WebGL sculpture representing workflow node connections. Server-side rendering Three.js scenes causes hydration mismatches and unnecessary GPU resource drain on background tabs.
- **Decision:** Load the Three.js / React Three Fiber canvas strictly on the client using dynamic imports. Pause render loops when the canvas is scrolled out of viewport, and render a high-quality CSS/SVG static fallback when `prefers-reduced-motion` is active or WebGL is unsupported.
- **Consequences:** Zero hydration errors, minimal CPU/GPU consumption on mobile and inactive tabs, and full accessibility compliance.

### ADR-06: HttpOnly Cookie Authentication & CSRF Origin Guard
- **Status:** Accepted
- **Context:** Storing JWT access tokens in browser `localStorage` leaves sessions vulnerable to token theft via Cross-Site Scripting (XSS). Conversely, pure cookie authentication introduces Cross-Site Request Forgery (CSRF) vulnerabilities.
- **Decision:** Transmit 15-minute JWT access tokens (`agentops_access`) and 30-day rotating refresh tokens (`agentops_refresh`) exclusively via `HttpOnly`, `SameSite=Lax`, `Secure` cookies. Implement a global `CsrfOriginGuard` that rejects cookie-authenticated state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) unless the `Origin` header matches `WEB_APP_URL`. Bearer token clients bypass Origin checking.
- **Consequences:** Eliminates script-accessible credentials while preventing forged cross-site state modifications.

### ADR-07: KEDA Autoscaling on Kafka Consumer Lag
- **Status:** Accepted
- **Context:** Asynchronous Kafka workers handle bursty batch workloads. Traditional CPU or memory-based Horizontal Pod Autoscaling (HPA) reacts too slowly to sudden spikes in queued messages.
- **Decision:** Deploy KEDA (Kubernetes Event-driven Autoscaling) on the AWS EKS production cluster. Configure `ScaledObject` resources monitoring Kafka consumer lag per consumer group and topic, scaling workers between 1 and 6 replicas.
- **Consequences:** Worker pools dynamically scale out when message queues build up and scale down to 1 replica during quiet periods, controlling AWS compute costs.

### ADR-08: AWS IAM OIDC Federation for GitHub Actions CI/CD
- **Status:** Accepted
- **Context:** Storing permanent AWS access keys (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) in GitHub repository secrets introduces a severe credential leakage risk.
- **Decision:** Configure AWS IAM OpenID Connect (OIDC) identity federation. GitHub Actions workflows assume short-lived IAM roles with trust policies restricted strictly to `repo:<owner>/agentops:environment:production`.
- **Consequences:** Zero long-lived AWS credentials exist in GitHub. Access tokens are generated on-demand with automatic 1-hour expiration.

### ADR-09: Container Hardening: Stripping npm/corepack & Trivy Vulnerability Gate
- **Status:** Accepted
- **Context:** Official Node.js base images (`node:22-alpine` or `node:22-slim`) bundle legacy `npm` and `corepack` binaries that frequently carry High and Critical Common Vulnerabilities and Exposures (CVEs).
- **Decision:** In multi-stage Dockerfiles, explicitly purge `/usr/local/lib/node_modules/npm` and `/usr/local/bin/corepack` from final runtime images. Implement a mandatory CI security step using `trivy-action` (pinned by commit SHA) that fails builds if any `CRITICAL` or `HIGH` vulnerabilities are detected.
- **Consequences:** Produces minimal, zero-CVE container images deployed to Amazon ECR.

### ADR-10: Platform Admin Bootstrapping via `PLATFORM_ADMIN_EMAILS`
- **Status:** Accepted
- **Context:** Multi-tenant systems require initial platform administrators to access `/admin` console capabilities without embedding hardcoded credentials in database migrations or public source code.
- **Decision:** Read `PLATFORM_ADMIN_EMAILS` (comma-separated list stored in AWS Secrets Manager) on login. Users whose email matches are promoted to `isPlatformAdmin = true` in PostgreSQL. Subsequent admin grants/revocations are managed in the UI. Administrators are blocked from modifying their own status.
- **Consequences:** Secure, reproducible bootstrap mechanism with an immutable database audit trail for all subsequent administrative actions.

### ADR-11: Distributed Tracing Root Span Initialization
- **Status:** Accepted
- **Context:** In early implementations, `RequestIdMiddleware` created synthetic parent span IDs for incoming HTTP requests lacking a W3C `traceparent` header. This left traces in Grafana Tempo waiting indefinitely for non-existent root spans.
- **Decision:** Update `RequestIdMiddleware` to inspect incoming headers. If no valid `traceparent` is provided, initialize the OpenTelemetry SERVER span with `root: true`, making the API request the authentic root of the trace.
- **Consequences:** Eliminates orphaned trace segments in Tempo, enabling unified waterfalls connecting HTTP requests to downstream Kafka worker spans.
