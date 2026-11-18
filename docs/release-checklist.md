# Release Checklist

This checklist defines the operational quality gates required before merging code to `main` and promoting releases to production. Copy this checklist into the pull request description or release tracking issue.

Related documentation:
- [Deployment and CI/CD](deployment.md): Automation architecture and rollout execution.
- [Production Runbook (AWS)](production-runbook-aws.md): Host updates, secret rotation, and verification commands.
- [Operations Runbook](runbook.md): Triage playbooks and rollback SOPs.

---

## 1. Pre-Merge Verification (Pull Request Stage)

- [ ] **CI Pipeline Checks Green**: The GitHub Actions `ci.yml` workflow passes on the pull request:
  - [ ] **Quality Job**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass with zero errors.
  - [ ] **Lead Golden Set Evaluation**: `pnpm eval:leads` meets accuracy gates:
    - [ ] Accuracy $\ge 0.90$.
    - [ ] Hot-lead miss rate $\le 0.10$.
    - [ ] JSON Schema valid rate $= 1.00$.
  - [ ] **Integration Test Suite**: `pnpm test:integration` passes (10/10 tests) against isolated PostgreSQL and Kafka containers (`docker compose --profile test`).
  - [ ] **Security Audits**:
    - [ ] `pnpm audit --prod --audit-level high` reports zero vulnerabilities.
    - [ ] Gitleaks secret scan reports zero leaked credentials or API keys.
  - [ ] **Infrastructure Linter Checks**:
    - [ ] `pnpm ci:lint`: `actionlint` and `shellcheck` pass cleanly.
    - [ ] `pnpm docker:lint`: `hadolint` passes on all Dockerfiles.
    - [ ] `pnpm k8s:validate`: `kubeconform` validates all Kubernetes manifests against schemas.
    - [ ] `pnpm tf:validate`: `tflint` and Terraform offline plan conform to `allowed-resources.json`.
  - [ ] **Container Image Scans**: Trivy vulnerability scan reports zero CRITICAL or HIGH vulnerabilities on all 6 application image builds.
- [ ] **Schema Migrations**:
  - [ ] All database migrations are strictly forward-only and backward-compatible.
  - [ ] Breaking changes (column renames, drops) follow the expand-and-contract pattern.
  - [ ] Migration Job manifest (`infrastructure/k8s/jobs/db-migrate`) is verified.
- [ ] **Environment Configuration**:
  - [ ] New configuration options are documented in `.env.example`.
  - [ ] Required production variables are configured in AWS Secrets Manager container `agentops/prod/app`.

---

## 2. Runtime Configuration and Feature Flags

- [ ] **Workflow Engine**: `WORKFLOW_AUTO_APPROVE="false"` in production (human review enforced).
- [ ] **UI Fallback**: `NEXT_PUBLIC_DEMO_FALLBACK="false"` in production.
- [ ] **Authentication Settings**:
  - [ ] `DEMO_LOGIN_ENABLED` is unset or `false` in production (prevents auto-generated `@agentops.local` owner accounts).
  - [ ] `DEMO_WORKSPACE_JOIN_ROLE="VIEWER"` configured (grants read-only access for new Google sign-in users).
  - [ ] `PLATFORM_ADMIN_EMAILS` populated in AWS Secrets Manager container `agentops/prod/app`.
- [ ] **Networking and Proxies**:
  - [ ] `API_TRUST_PROXY="1"` behind Ingress-NGINX (preserves client IP for rate limiting; never set to `true`).
  - [ ] `AUTH_COOKIE_DOMAIN` matches the current production hostname (`agentops.<lb-ip-dashed>.sslip.io`).
  - [ ] `GOOGLE_OAUTH_REDIRECT_URI` matches `https://api.agentops.<lb-ip-dashed>.sslip.io/auth/google/callback`.
- [ ] **Guardrails and Quotas**:
  - [ ] `AI_DAILY_CALL_LIMIT` and `AI_DAILY_TOKEN_LIMIT` set to budget-approved limits.
  - [ ] `API_RATE_LIMIT_PER_MINUTE` and `AUTH_RATE_LIMIT_PER_MINUTE` active.
  - [ ] `ALERTMANAGER_WEBHOOK_TOKEN` configured in Secrets Manager and matches Alertmanager HTTP auth.

---

## 3. Production Deployment Execution

- [ ] **Initiate Deployment**:
  - [ ] Direct push to `main` triggers `deploy-prod.yml`.
  - [ ] Production environment approval granted by designated release reviewer on GitHub Actions.
- [ ] **Artifact Generation**:
  - [ ] 7 container images built and tagged with commit SHA: `api`, `tools`, `web`, `workflow-worker`, `ai-worker`, `tool-worker`, `notification-worker`.
  - [ ] Images pushed to AWS ECR repositories (`<registry>/prod/<app>:<commit-sha>`).
- [ ] **K8s Deploy Script Execution (`scripts/k8s-deploy.sh`)**:
  - [ ] Pre-flight placeholder validation passes (no leftover placeholders in manifests).
  - [ ] Database migration Job (`agentops-db-migrate`) completes within 300s timeout.
  - [ ] Workload rollout completes within 180s timeout across all 6 Deployments.
  - [ ] Ingress smoke tests pass:
    - [ ] `GET /health/ready` returns HTTP 200 with all dependencies (`postgres`, `redis`, `kafka`) reporting `up`.
    - [ ] `GET /health/live` returns HTTP 200.

---

## 4. Post-Deployment Verification

- [ ] **Automated Verification**:
  - [ ] Run `scripts/verify-prod.mjs` against the live production host:
    ```bash
    KUBECONFIG=<prod-kubeconfig> node scripts/verify-prod.mjs --host agentops.<lb-ip-dashed>.sslip.io
    ```
  - [ ] Confirm all **27 / 27 checks pass** (Endpoints, TLS, Workloads, Autoscaling, Prometheus, Alerting, Tracing).
- [ ] **TLS Certificate Status**: Confirm Let's Encrypt certificate is valid for web and API hosts with > 7 days remaining.
- [ ] **Prometheus Scrape Health**:
  - [ ] All 7 scrape targets report `UP` (2 API pods, 4 workers, Prometheus itself).
  - [ ] All 17 alert rules loaded across 5 groups.
  - [ ] Zero warning or critical alerts firing.
- [ ] **Alert Delivery Chain**:
  - [ ] Trigger synthetic test alert probe; confirm API webhook records notification (`agentops_alertmanager_notifications_total` increments).
- [ ] **Observability Soak (30 Minutes)**:
  - [ ] Monitor Grafana **AgentOps - RED** dashboard for unexpected 5xx spikes or latency degradation.
  - [ ] Monitor Grafana **AgentOps - Kafka** dashboard: consumer lag remains stable; no growing backlog.
  - [ ] Monitor `dead-letter-events` topic: zero messages routed to dead-letter storage (`AgentOpsDeadLettersIncreasing` silent).

---

## 5. Rollback Contingency Checklist

- [ ] **Pre-Release Baseline**: Record previous known-good commit SHA and image tag.
- [ ] **Automatic Rollback**: Verify that `scripts/k8s-deploy.sh` automatic rollback mechanism is operational.
- [ ] **Manual Rollback Command**:
  - [ ] Via GitHub Actions: `deploy-prod.yml` dispatched with input `image_tag: <previous-commit-sha>`.
  - [ ] Via CLI:
    ```bash
    for d in agentops-api agentops-web workflow-worker ai-worker tool-worker notification-worker; do
      kubectl -n agentops rollout undo deploy/$d
    done
    ```
- [ ] **Database Recovery Plan**: Confirm existence of manual RDS snapshot if releasing risky schema modifications.
