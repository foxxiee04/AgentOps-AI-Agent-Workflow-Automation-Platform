# Release Checklist

Use this before merging and before promoting to production. Copy it into the PR / release issue and tick each box.

## Before merge

- [ ] PR checks are green (quality, integration, security, infra, image scans).
- [ ] Golden set passes: accuracy **≥ 0.9** and hot-lead miss **≤ 0.1** (`POST /ai/evaluate-agent` or `pnpm eval:leads`).
- [ ] Migrations reviewed and backward compatible (no destructive change in a normal release; the migration Job runs before the app).
- [ ] New environment variables are documented in `.env.example` and added to the ConfigMap / secret for every environment.

## Feature flags

- [ ] `WORKFLOW_AUTO_APPROVE=false` outside local.
- [ ] `NEXT_PUBLIC_DEMO_FALLBACK=false`.
- [ ] AI provider switch (`modelProvider: mock | openai`) is set per node as intended for the environment.
- [ ] `AI_DAILY_CALL_LIMIT` / `AI_DAILY_TOKEN_LIMIT` are set to the expected values.
- [ ] `API_RATE_LIMIT_PER_MINUTE` / `AUTH_RATE_LIMIT_PER_MINUTE` are set to the expected values.
- [ ] `API_TRUST_PROXY` matches the number of proxies in front of the API (1 behind ingress-nginx).
- [ ] `DEMO_LOGIN_ENABLED` is unset or `false` outside local (no auto-created `@agentops.local` OWNER accounts).
- [ ] `ALERTMANAGER_WEBHOOK_TOKEN` is set in the app secret and Alertmanager sends it (`http_config.authorization`).

## Deploy

- [ ] Dev deploy is green (automatic on `main`).
- [ ] Smoke test passes in dev (`/health/ready` + `/health/live`).
- [ ] Grafana **AgentOps - API and Workers (RED)** and **AgentOps - AI** dashboards are normal for 30 minutes after the dev deploy.
- [ ] No new dead letters (`AgentOpsDeadLettersIncreasing` silent; `dead-letter-events` empty for this release).
- [ ] Promote the same tested tag to prod via `deploy-prod.yml` with reviewer approval (no rebuild).

## Rollback plan

- [ ] Previous known-good tag is noted for prod.
- [ ] Automatic `rollout undo` in `scripts/k8s-deploy.sh` is verified (failure path exercised in dev).
- [ ] An RDS snapshot exists for any risky or destructive migration.

## Alerts

- [ ] Prometheus rules are loaded (`infrastructure/observability/prometheus/rules/agentops-alerts.yml`; `up` for the rules file / no config errors).
- [ ] Alertmanager → alert bot path is reachable (`POST /notifications/alertmanager`, `ALERT_BOT_WEBHOOK_URL` set); `AgentOpsAlertBotInactive` is not firing.

## After release

- [ ] Watch error ratio, p95 latency, and consumer lag on the dashboards.
- [ ] Watch cost per lead (AI calls/tokens against `AI_DAILY_*` limits).
