# AgentOps - Portfolio

AgentOps is an AI agent workflow automation platform built end to end: product UI, event-driven backend, AI agent
with human approval, multi-tenant security, a platform admin console, observability, CI/CD and a production
deployment on AWS. This page collects the evidence: what the system does, how it is built, how it is operated and how
it was verified. Every screenshot below was taken from the running system on 2026-11-17/18.

> Live demo: [agentops.18-136-215-126.sslip.io](https://agentops.18-136-215-126.sslip.io) (the sslip.io host embeds the
> AWS load-balancer IP and changes whenever the stack is rebuilt; the stack is short-lived to keep costs down).

| | |
| --- | --- |
| Role | Solo build: product, design system, frontend, backend, AI integration, infrastructure, CI/CD, testing, docs |
| Stack | Next.js 16 · React 19 · NestJS 11 · Prisma 7 · PostgreSQL 16 · Kafka · Redis · OpenAI · three.js · Terraform · EKS · GitHub Actions · Prometheus · Grafana · Tempo |
| Scale of the work | 129 commits in 26 merged pull requests, 7 deployable images, 54 Terraform-managed AWS resources |
| Quality gates | 117 web + 237 API unit tests, 10 integration tests, 24 Playwright end-to-end scenarios (run in CI), Trivy/gitleaks/audit in CI, 27/27 production checks |

## 1. The product

A lead enters the system (form, API or webhook). An AI agent scores purchase intent and drafts a follow-up email,
the workflow branches on the score, a human approves or rejects the draft, and the run ends with a sales task. Every
step is recorded and visible.

![Landing page with the WebGL hero sculpture](images/portfolio/landing-3d-hero.png)

The landing hero is a real-time WebGL sculpture (React Three Fiber): four moss "workflow nodes" joined by thin lines,
floating and turning slowly, leaning towards the pointer; the AI node carries a glowing live core. It is loaded only
in the browser, pauses when scrolled away, and falls back to a static illustration for reduced motion or devices
without WebGL.

### Operator dashboard

![Dashboard](images/app/03-dashboard.png)

KPIs, run activity, run outcomes, lead quality, scored leads and the sales task list for the active workspace.

| Workflow builder | Run history |
| --- | --- |
| ![Builder](images/app/05-builder.png) | ![Runs](images/app/06-runs.png) |
| **Run timeline** | **Human approval queue** |
| ![Run detail](images/app/07-run-detail.png) | ![Approvals](images/app/08-approvals.png) |

| Sign-in (Google first) | Mobile (Vietnamese) |
| --- | --- |
| ![Login](images/app/02-login.png) | ![Mobile dashboard](images/portfolio/vi/11-mobile-dashboard.png) |

The interface is bilingual (Vietnamese / English) and follows the **Moss Atelier** design system: Playfair Display
for display type (chosen because it has full Vietnamese glyph coverage), Inter Tight for UI, JetBrains Mono for
labels, a warm stone and moss palette with lime reserved for live states, hairline grids and glass navigation. The
direction was chosen from a gallery of real templates and three animated options
([design brief](../design/design-brief.md)).

## 2. Platform admin console

A platform-level area for operators of the whole service: statistics, account management and reports.

![Admin overview](images/portfolio/admin-overview.png)

| Accounts | Audit log |
| --- | --- |
| ![Admin accounts](images/portfolio/admin-accounts.png) | ![Admin audit](images/portfolio/admin-audit.png) |

- Platform statistics for 7, 30 or 90 days: users, active users, workspaces, runs and success rate, AI calls and
  tokens, approvals, lead categories, sign-ups by provider, daily series and top workspaces.
- Account management: search and filter, disable / enable, grant / revoke platform admin, account details.
- CSV reports (users, workspaces, runs, usage) that open cleanly in Excel and are safe against formula injection.
- Security: a disabled account loses access on its next request (the JWT guard checks the flag and refresh tokens
  are revoked); every admin action is audited; admins cannot change their own account; the admin list for production
  lives in AWS Secrets Manager, not in the repository.

## 3. Architecture

```mermaid
flowchart LR
  WEB[Next.js web] -->|REST, HttpOnly cookies| API[NestJS API]
  API --> PG[(PostgreSQL)]
  API --> REDIS[(Redis)]
  API -->|domain events| K{{Kafka}}
  K --> WW[workflow-worker]
  K --> AW[ai-worker]
  K --> TW[tool-worker]
  K --> NW[notification-worker]
  AW -->|gpt-4o-mini or mock| LLM[LLM]
  WW & AW & TW & NW --> PG
  WW & AW & TW & NW --> K
  API & WW & AW & TW & NW -. traces .-> TEMPO[Tempo]
  PROM[Prometheus] -. scrape .-> API & WW & AW & TW & NW
  PROM --> AM[Alertmanager] -->|webhook| API
```

- **Modular monolith + workers**: users, workspaces, workflow versions, permissions and audit share one domain model
  in the API; execution is split into four Kafka consumers that scale and fail independently.
- **Reliable execution**: at-least-once delivery, idempotent consumers (`ProcessedMessage`), retries and dead letters,
  an outbox for domain events.
- **AI agent**: JSON-schema validated output, PII masking, prompt-injection guardrail, per-workspace daily quotas,
  a golden-set evaluation in CI.
- **Multi-tenancy**: workspace roles (OWNER / ADMIN / MEMBER / VIEWER), every dashboard query scoped to a workspace
  the caller belongs to, plus a platform admin role above workspaces.

Details: [architecture](architecture.md) · [workflow engine](workflow-engine.md) · [API](api.md) ·
[security](security.md).

## 4. Observability

One lead run, traced end to end across three services (API -> Kafka -> workflow-worker -> ai-worker -> back to the
workflow-worker for the condition and the human approval step):

![Distributed trace in Tempo](images/portfolio/grafana-tempo-trace.png)

| Grafana: platform overview | Grafana: RED metrics |
| --- | --- |
| ![Grafana overview](images/portfolio/grafana-5-overview.png) | ![Grafana RED](images/portfolio/grafana-2-red.png) |
| **Grafana: Kafka** | **Grafana: AI** |
| ![Grafana Kafka](images/portfolio/grafana-3-kafka.png) | ![Grafana AI](images/portfolio/grafana-1-ai.png) |

Production Prometheus and Alertmanager (port-forwarded from the EKS cluster; monitoring is not exposed publicly):

| Scrape targets | Alert rules |
| --- | --- |
| ![Prometheus targets](images/portfolio/prod-prometheus-targets.png) | ![Alert rules](images/portfolio/prod-prometheus-alert-rules.png) |
| **Worker throughput per Kafka topic** | **Alertmanager** |
| ![Worker throughput](images/portfolio/prod-prometheus-worker-throughput.png) | ![Alertmanager](images/portfolio/prod-alertmanager.png) |

- Prometheus scrapes the API pods and all four workers; 17 alert rules in 5 groups; Alertmanager posts to an API
  webhook (the "alert bot"), which counts and stores notifications.
- While preparing this page a real tracing defect was found and fixed: the API invented a parent span for requests
  without a `traceparent` and inherited stale async context across keep-alive requests, so every trace in Tempo
  waited for a root span that never arrived. Request spans now start a new trace, and the run above shows the result.

Details: [observability](observability.md).

## 5. Delivery: CI/CD and AWS

![Deploy prod run](images/portfolio/github-actions-deploy-prod.png)

| Pull request history | Workflows |
| --- | --- |
| ![Merged PRs](images/portfolio/github-merged-prs.png) | ![Actions](images/portfolio/github-actions-workflows.png) |

- **PR checks**: lint, typecheck, unit tests, build, AI golden-set eval, integration tests on real Kafka + Postgres,
  `pnpm audit`, gitleaks, actionlint, shellcheck, hadolint, kubeconform, terraform validate, and a Trivy
  CRITICAL/HIGH gate on six images (trivy-action pinned by commit SHA).
- **Continuous delivery**: every merge to `main` builds seven images tagged with the commit id, pushes them to ECR,
  runs the database migration Job, rolls out, smoke-tests and rolls back automatically on failure. AWS access uses
  GitHub OIDC, no stored keys.
- **Infrastructure**: Terraform for VPC, EKS 1.31, RDS PostgreSQL, ElastiCache Redis (TLS), MSK Kafka 3.9, ECR,
  Secrets Manager and IAM; ingress-nginx on an NLB, cert-manager with Let's Encrypt, External Secrets, KEDA scaling
  workers on Kafka lag, an HPA on the API.
- Hardening found along the way: runtime images no longer ship the npm CLI (its dependencies carried HIGH CVEs), the
  ingress route list was extended for the admin API, and the web build retries transient Google Fonts download errors.

Details: [deployment](deployment.md) · [AWS architecture](aws-kubernetes-deployment.md) ·
[production runbook](production-runbook-aws.md).

## 6. Verification

| Suite | Result (2026-11-18) |
| --- | --- |
| Web unit tests (Vitest) | 117 / 117 |
| API unit tests | 237 / 237 |
| Integration tests (real Kafka + PostgreSQL) | 10 / 10 |
| Playwright end-to-end scenarios | 24 / 24 |
| Production checks (`scripts/verify-prod.mjs`) | 27 / 27 |

The end-to-end suite covers the full lead flow through the UI, navigation and auth, the pipeline through the public
API (hot lead with approval, rejection, spam branch, prompt injection), the admin console (statistics, CSV export,
disable / enable, grant / revoke with audit), workspace isolation and security (401s, the Origin check for cookie
requests, a disabled account losing access, self-change refused).

The production check script verifies endpoints and TLS, workloads and restarts, autoscaling (HPA and KEDA),
Prometheus targets, rules and firing alerts, an end-to-end alert through Alertmanager to the API webhook, and a trace
spanning several services in Tempo. Latest report: [evidence/prod-verification.md](evidence/prod-verification.md).

Details: [test plan](test-plan.md) · [test scenarios and results](test-scenarios.md).

## 7. What I would do next

- A real email provider (SES) instead of the mock sender, and a custom domain instead of sslip.io.
- Workspace-scoped AI usage, billing on top of the usage records, and a UI for webhook endpoints.
- Move human AWS access off the root account, add WAF in front of the NLB and TLS to MSK.

Already done in the hardening round of 2026-11-18: signed webhook endpoints that start real runs, alerts stored in
PostgreSQL, NetworkPolicy enforced on EKS, persistent EBS volumes for the monitoring stack, Terraform state in S3 with
locking, production AI nodes on OpenAI, and the Playwright suite running on every pull request.
