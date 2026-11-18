# Test Scenarios and Results Catalog

This document details all automated test scenarios implemented in AgentOps, including the 24 Playwright end-to-end (E2E) specifications, the integration test suite, and the historical record of test run results.

Related documentation:
- [Test Plan and QA Strategy](test-plan.md): Test pyramid, tooling, datasets, and acceptance gates.
- [Local Runbook](local-runbook.md): Local development setup and inner-loop testing commands.
- [Deployment and CI/CD](deployment.md): Automated CI/CD pipeline stages.
- [Production Verification Report](evidence/prod-verification.md): Automated verification results for the production cluster.

---

## 1. Quick Reference: Test Commands

```bash
# Run all Playwright E2E scenarios against running local stack
pnpm test:e2e
# (Equivalent to: pnpm --filter @agentops/web test:e2e)

# Run integration tests against real Kafka and PostgreSQL
pnpm test:integration

# Run all unit test suites across the monorepo
pnpm test

# Run lead evaluation golden set benchmark
pnpm eval:leads

# Run production cluster verification script
node scripts/verify-prod.mjs --host agentops.<lb-ip-dashed>.sslip.io
```

---

## 2. Test Execution Results History

### Results — 2026-11-18, after the hardening round (Latest)

| Test Suite | Total | Passed | Failed | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| **API Monolith Unit Tests** | 237 | 237 | 0 | **PASS** | Adds webhooks, persistent notifications, audit log, AI task lookup |
| **Workers & Packages Unit** | 121 | 121 | 0 | **PASS** | Adds the AI provider override |
| **Playwright E2E in PR checks** | 24 | 24 | 0 | **PASS** | First run of the `e2e` CI job (PR #40), Docker Compose stack on `ubuntu-24.04` |
| **Webhook run on production** | 1 | 1 | 0 | **PASS** | 401 / 202 / 404 as designed; first run exposed an expired OpenAI key, rerun completed on the mock provider |
| **Production Verification** | 27 | 27 | 0 | **PASS** | [report](evidence/prod-verification.md), details in [hardening evidence](evidence/hardening-2026-11-18.md) |

---

### Results — 2026-11-18 (Before the hardening round)

Executed on 2026-11-18 against the local stack and the active AWS EKS production cluster (`agentops.18-136-215-126.sslip.io`):

| Test Suite | Total Scenarios | Passed | Failed | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| **Web App Unit Tests** | 117 | 117 | 0 | **PASS** | Includes Moss Atelier UI components, design tokens, hooks |
| **API Monolith Unit Tests**| 208 | 208 | 0 | **PASS** | Includes admin service/guard, disabled accounts, CSV export |
| **Workers & Packages Unit**| 116 | 116 | 0 | **PASS** | Graph execution, branching, idempotency, AI validation |
| **Monorepo Unit Total** | **441** | **441** | **0** | **PASS** | Full in-memory unit test coverage across 12 packages |
| **Integration Suite** | 10 | 10 | 0 | **PASS** | Real Kafka 4.3 + PostgreSQL 16 (`profile: test`) |
| **Playwright E2E Suite** | 24 | 24 | 0 | **PASS** | All 6 test specifications passing on single worker |
| **Lead Golden Set Eval** | 24 | 24 | 0 | **PASS** | Accuracy: 1.00, Hot-lead miss: 0.00, Schema valid: 1.00 |
| **Production Verification**| 27 | 27 | 0 | **PASS** | All 27 checks passed on AWS EKS ([report](evidence/prod-verification.md)) |

---

### Results — 2026-11-17 (Previous Milestone)

Executed on 2026-11-17 following the initial Moss Atelier redesign and workspace isolation changes:

| Test Suite | Total Scenarios | Passed | Failed | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| **Web App Unit Tests** | 106 | 106 | 0 | **PASS** | Initial redesign verification |
| **API, Workers, Packages** | 310 | 310 | 0 | **PASS** | API: 194 tests; workers and packages: 116 tests |
| **Integration Suite** | 10 | 10 | 0 | **PASS** | One transient Kafka connection retry during initial broker boot |
| **Playwright E2E Suite** | 12 | 12 | 0 | **PASS** | Baseline navigation, flow, and API pipeline tests |
| **Production Showcase Seed**| 44 | 44 | 0 | **PASS** | 44 leads scored: 22 email path, 15 approved, 3 rejected, 4 waiting |

---

## 3. Playwright End-to-End Test Scenarios (24 Scenarios)

The automated E2E test suite lives in `apps/web/e2e/` and executes using Chromium via `apps/web/playwright.config.ts`.

### 3.1 UI Lead Qualification Flow (`agentops-flow.e2e.ts`)

| Test ID | Scenario Title | Implementation / Steps | What It Proves | Outcome |
| --- | --- | --- | --- | --- |
| **TC-FLOW-01** | Lead flow: login, create, publish, run, approve, task created | Logs in with `@agentops.local` user; creates workflow from lead template; publishes graph; triggers manual hot lead; verifies run timeline; navigates to `/approvals` and approves email draft; verifies run completion and sales task creation on dashboard | Proves full end-to-end integration: React Flow builder, API event dispatch, worker orchestration, PII email masking (`an***@shopabc.vn`), human approval decisioning, and dashboard updates | **PASS** |

---

### 3.2 Navigation, Localization, and Accessibility (`navigation.e2e.ts`)

| Test ID | Scenario Title | Implementation / Steps | What It Proves | Outcome |
| --- | --- | --- | --- | --- |
| **TC-NAV-01** | Landing page renders in English and Vietnamese | Navigates to `/en`; clicks header locale toggle; asserts URL changes to `/vi` and verifies localized headlines | Proves bilingual localization, SSR translation hydration, and client header routing | **PASS** |
| **TC-NAV-02** | App screens redirect to login without a session | Navigates directly to `/dashboard?lang=en` with empty browser storage | Proves client/server authentication gate redirects unauthenticated users to `/login` | **PASS** |
| **TC-NAV-03** | Login rejects wrong password format and retains form | Submits login form with invalid password format | Proves client form validation displays inline warning notices without clearing form state | **PASS** |
| **TC-NAV-04** | Every app screen loads without page errors | Logs in; iterates through `/dashboard`, `/workflows`, `/runs`, `/approvals`, `/agents`, `/settings`; checks headings and sidebar active state | Proves zero runtime JavaScript exceptions across all authenticated application views | **PASS** |
| **TC-NAV-05** | Mobile layout shows top navigation and no horizontal overflow | Sets browser viewport to 390 x 844 (mobile phone); verifies top navigation header and asserts document scroll width matches client width | Proves responsive mobile layout conforms to viewport boundaries without horizontal scroll overflow ($\le 1\text{px}$) | **PASS** |

---

### 3.3 Event Pipeline through the API (`pipeline-api.e2e.ts`)

| Test ID | Scenario Title | Implementation / Steps | What It Proves | Outcome |
| --- | --- | --- | --- | --- |
| **TC-API-01** | Readiness reports PostgreSQL, Redis and Kafka as up | Issues `GET /health/ready` via API request context | Proves NestJS Terminus readiness probe actively checks PostgreSQL, Redis, and Kafka brokers | **PASS** |
| **TC-API-02** | Workspace routes reject anonymous callers | Issues unauthenticated `GET /workflows?workspaceId=ws_demo` | Proves workspace-scoped API endpoints strictly enforce 401 Unauthorized for anonymous callers | **PASS** |
| **TC-API-03** | Lead without required fields is rejected with field errors | Posts workflow run payload missing required `email` property | Proves input payload validation returns 400 Bad Request with field-level validation errors | **PASS** |
| **TC-API-04** | Spam lead is scored and finishes without approval (Branch B) | Triggers lead containing promotional casino copy; polls run until terminal state | Proves AI intent scoring categorizes spam leads correctly and routes execution through Branch B directly to end node | **PASS** |
| **TC-API-05** | Hot lead waits for approval; rejecting skips email; decision is final | Triggers hot enterprise lead; awaits `WAITING_APPROVAL`; posts rejection with comment; asserts email skipped, sales task created, and duplicate decision returns 409 | Proves human approval rejection semantics: email delivery skipped, follow-up task created with rejection reason, and first decision is immutable (409 Conflict) | **PASS** |
| **TC-API-06** | Prompt injection in lead message is classified as spam | Submits lead message attempting system prompt extraction and instruction override | Proves AI scoring prompt defenses classify adversarial prompt injections as spam | **PASS** |

---

### 3.4 Platform Admin Console (`admin.e2e.ts`)

| Test ID | Scenario Title | Implementation / Steps | What It Proves | Outcome |
| --- | --- | --- | --- | --- |
| **TC-ADM-01** | Platform admin sees overview KPIs and charts and can switch range | Signs in as `operator@agentops.local`; opens `/admin`; asserts KPI cards and daily charts; toggles date range between 7 days and 30 days | Proves platform admin authorization, multi-tenant metric aggregation, and interactive chart filtering | **PASS** |
| **TC-ADM-02** | Users CSV report downloads with expected header row | Admin clicks download link for users report; asserts download event and inspects first line of generated CSV file | Proves CSV export generation, UTF-8 BOM encoding, formula-injection sanitization, and correct column structure | **PASS** |
| **TC-ADM-03** | Admin disables fresh account in UI and enables it again | Creates target user; admin searches user in `/admin?tab=accounts`; clicks Lock button and confirms; verifies login returns 403; admin unlocks; verifies login succeeds | Proves administrative user lock/unlock workflow, immediate credential invalidation, and UI audit updates | **PASS** |
| **TC-ADM-04** | Granting and revoking platform admin writes audit rows | Admin grants platform admin rights to user; revokes rights; opens `/admin?tab=audit` and filters by action name | Proves privilege escalation/de-escalation controls and immutable administrative audit trail recording | **PASS** |
| **TC-ADM-05** | Non-admin sees no-permission UI, no admin nav item and gets 403 from admin API | Authenticates as regular user; attempts opening `/admin`; asserts "No permission" notice and lack of admin link; sends `GET /admin/overview` | Proves platform admin RBAC gate enforces security at both frontend UI and backend API boundaries | **PASS** |

---

### 3.5 Workspace Isolation (`workspace.e2e.ts`)

| Test ID | Scenario Title | Implementation / Steps | What It Proves | Outcome |
| --- | --- | --- | --- | --- |
| **TC-WS-01** | Registering in UI lands in personal workspace with empty dashboard | Registers new user via `/register`; verifies redirect to `/dashboard`; asserts user holds OWNER role in new workspace and sees empty state | Proves registration creates an isolated personal workspace; prevents leakage of demo workspace data to new tenants | **PASS** |
| **TC-WS-02** | New user cannot read demo workspace and needs workspace id | Issues `GET /dashboard/overview?workspaceId=ws_demo` with new user token; issues `GET /dashboard/overview` without query parameter | Proves strict cross-tenant isolation (403 Forbidden on foreign workspaces) and required workspace context validation (400) | **PASS** |
| **TC-WS-03** | `/auth/me` lists user workspace with OWNER role | Queries `/auth/me` with newly registered session token | Proves session contract accurately returns user metadata, non-admin flag, and authorized workspace membership | **PASS** |

---

### 3.6 Security and Authentication (`security.e2e.ts`)

| Test ID | Scenario Title | Implementation / Steps | What It Proves | Outcome |
| --- | --- | --- | --- | --- |
| **TC-SEC-01** | Protected endpoints answer 401 without a session | Issues unauthenticated requests to `/auth/me`, `/dashboard/overview`, `/admin/overview` | Proves JWT authentication guard enforces 401 Unauthorized across all private API routes | **PASS** |
| **TC-SEC-02** | Cookie-authenticated writes need web Origin header | Issues cookie-authenticated `POST /auth/logout` without Origin header (asserts 403); repeats with valid web Origin header (asserts 200) | Proves CSRF origin-verification guard prevents unauthorized cross-site form submissions | **PASS** |
| **TC-SEC-03** | Disabling account revokes existing access token immediately | Issues administrative PATCH to disable user; immediately probes `/auth/me` using existing active token | Proves token revocation mechanism: disabled users lose API access on their next request without waiting for token TTL expiration | **PASS** |
| **TC-SEC-04** | Admin cannot disable their own account | Admin sends PATCH request to disable their own user identifier | Proves self-disablement protection prevents administrative account lockout (400 Bad Request) | **PASS** |

---

## 4. Integration Test Suite (`packages/integration-tests/src`)

The integration test suite runs against real PostgreSQL 16 and Kafka 4.3 brokers started via `docker compose --profile test up -d`:

| Test Specification | Scope / Scenario | Key Assertions |
| --- | --- | --- |
| **`lead-flow.int.test.ts` (1)** | Hot lead lifecycle | Scores lead, branches to `approval-1`, waits for human approval, sends mock email on approval, creates sales task, ignores redelivered Kafka events via `ProcessedMessage` idempotency table |
| **`lead-flow.int.test.ts` (2)** | Low-intent lead bypass | Scores lead as low intent, evaluates condition, skips email and approval nodes, completes run directly |
| **`lead-flow.int.test.ts` (3)** | Rejected email follow-up | Human rejection requires $\ge 3$ characters of notes; skips email node; creates sales task recording reviewer's rejection reason |
| **`lead-flow.int.test.ts` (4)** | Provider outage resilience | Simulates provider outage; worker retries 3 times, routes message to `dead-letter-events`, and transitions run to `FAILED` |
| **`lead-flow.int.test.ts` (5)** | Approval RBAC enforcement | Anonymous requests receive 401; users with workspace role `VIEWER` receive 403 when attempting approval decisions |
| **`lead-flow.int.test.ts` (6)** | Browser cookie security | Verifies `agentops_access` and `agentops_refresh` cookies are `HttpOnly` and `SameSite=Lax`; validates CSRF Origin checks on write requests |
| **`lead-flow.int.test.ts` (7)** | Refresh token rotation | Calls `/auth/refresh` to issue new token pair; asserts previous refresh token is invalidated |
| **Database Migration Integrity** | Migration deployment | Runs `prisma migrate deploy` against empty PostgreSQL database; verifies all tables, foreign keys, and indexes create without errors |

---

## 5. Production Verification Suite (`scripts/verify-prod.mjs`)

The automated production verification script probes the live AWS EKS cluster across 27 distinct checks:

| Category | Checks | Probes & Expectations | Result |
| --- | --- | --- | --- |
| **Endpoints** | 6 | Web landing (200), API readiness (200), API liveness (200), protected route without token (401), admin route without token (401), metrics endpoint blocked from public ingress (404) | **6 / 6 PASS** |
| **TLS** | 2 | Valid Let's Encrypt certificates issued for both `agentops.<host>` and `api.agentops.<host>` with $\ge 90$ days remaining | **2 / 2 PASS** |
| **Workloads** | 7 | Readiness of all 6 Deployments (`agentops-api`, `agentops-web`, `workflow-worker`, `ai-worker`, `tool-worker`, `notification-worker`); 8 running pods; 0 container restarts | **7 / 7 PASS** |
| **Autoscaling** | 2 | Kubernetes CPU HPA active for API; KEDA `ScaledObject` resources active for all 4 workers with Kafka lag triggers | **2 / 2 PASS** |
| **Prometheus** | 7 | 7 scrape targets UP (2 API pods, 4 workers, Prometheus); 17 alert rules active; 0 warning/critical alerts firing; metrics recording | **7 / 7 PASS** |
| **Alerting** | 1 | End-to-end alert delivery: Alertmanager dispatches synthetic probe alert to API webhook; verified by counter increment | **1 / 1 PASS** |
| **Tracing** | 2 | 5 distinct services exporting spans to Tempo; verified distributed trace traversing API and worker boundaries for a single lead run | **2 / 2 PASS** |
| **Total** | **27** | **Complete production readiness verification** | **27 / 27 PASS** |
