# Operations Runbook

Day-two operations for AgentOps: how to deploy, roll back, respond to alerts, and run common operational tasks. Use this with `docs/deployment.md` (pipeline layout) and `docs/local-runbook.md` (local setup).

All Kubernetes commands run in namespace `agentops`.

## Deploy

1. **Dev is automatic.** A merge to `main` triggers `deploy-dev.yml`, which builds and pushes commit-tagged images to `dev/<app>`, runs the migration Job, rolls out every Deployment, smoke tests `/health/ready` and `/health/live`, and rolls back automatically on failure.
2. **Prod is a manual promotion with approval.** Dispatch `deploy-prod.yml` with a tag that is already tested in dev. The workflow pauses on the `production` environment's required reviewers before it proceeds.
3. **Image promotion, no rebuild.** Prod promotes the same image tag that passed dev (the digests are re-tagged into `prod/<app>`); it does not build from source. The same tag that was smoke-tested is the tag that runs in production.
4. **Migration Job first.** `scripts/k8s-deploy.sh` always applies and waits for the `agentops-db-migrate` Job to complete (`--timeout=300s`) before it touches the Deployments. If the Job fails, the script prints its logs and exits without rolling out any app.

Deploy by hand (only when a pipeline is unavailable):

```bash
REGISTRY=<account>.dkr.ecr.<region>.amazonaws.com
./scripts/k8s-deploy.sh prod <tag> "$REGISTRY" https://api.agentops.example
```

## Rollback

- **Automatic.** `scripts/k8s-deploy.sh` records the images running before the rollout. If any `rollout status`, `/health/ready`, or `/health/live` check fails, it runs `kubectl -n agentops rollout undo deploy/<name>` for all six Deployments and exits non-zero with `ROLLED BACK`.
- **Manual application rollback.** Undo a single Deployment, or re-run `deploy-prod.yml` with the previously known-good tag to move everything back together:

  ```bash
  kubectl -n agentops rollout undo deploy/agentops-api
  kubectl -n agentops rollout status deploy/agentops-api
  ```

  Name each Deployment explicitly (`agentops-api`, `agentops-web`, `workflow-worker`, `ai-worker`, `tool-worker`, `notification-worker`) — the script rolls all of them back, a single `undo` only moves one.
- **Database.** Migrations are **forward-only**; there is no down migration to run. For an additive/backward-compatible migration, rolling the code back is enough. Restore from the RDS snapshot **only** for a destructive migration that already ran, and treat that as a review-gated, last-resort action: the restore loses writes made after the snapshot, so get sign-off before starting it.

## Alerts

Rules live in `infrastructure/observability/prometheus/rules/agentops-alerts.yml`. For every alert below: start on Grafana, then pivot to a Tempo trace by `workflowRunId`, then to logs by `requestId` / `workflowRunId` / `traceId` / `eventId`.

Grafana dashboards referenced: **AgentOps - API and Workers (RED)** (API rate/errors/duration), **AgentOps - API and Workers (RED)** (worker throughput, errors, latency), **AgentOps - Kafka** (consumer lag, topics), **AgentOps - AI** (provider calls, quota, validation).

Log correlation fields: `requestId` (HTTP request), `traceId` / `traceparent` (W3C trace), `workflowRunId` (one workflow execution), `eventId` (one Kafka message). In Tempo, search by `workflowRunId` to see the full run across api and worker spans.

### AgentOpsApiDown (critical)

- **Means:** Prometheus cannot scrape `agentops-api` `/metrics` for more than 1 minute (`up == 0`).
- **First checks:** AgentOps - API and Workers (RED) dashboard; `kubectl -n agentops get pods -l app=agentops-api`; pod events and last logs; ingress reachability of `/metrics` and `/health/live`.
- **Causes / action:** crash loop or OOM, failed rollout, or a network/Service change. If the pod is crash looping, check the last logs for a startup error (DB/Kafka connection, missing env). If it is a bad rollout, roll back: `kubectl -n agentops rollout undo deploy/agentops-api`.

### AgentOpsApiHighErrorRate (warning)

- **Means:** 5xx responses are above 5% of API requests for 5 minutes.
- **First checks:** AgentOps - API and Workers (RED) dashboard; error responses carry `requestId` — grep api logs by `requestId`; Tempo trace by `traceId`/`requestId` for the failing span.
- **Causes / action:** a dependency is failing (Postgres, Redis, Kafka) or a recent deploy regressed a handler. Check `/health/ready` for dependency state; if it tracks a fresh deploy, roll back; otherwise fix the failing dependency.

### AgentOpsApiHighLatencyP95 (warning)

- **Means:** API p95 latency is above 1s for 5 minutes.
- **First checks:** AgentOps - API and Workers (RED) dashboard (which routes); slow spans in Tempo by `traceId`; Postgres/Redis latency; `/metrics` histograms.
- **Causes / action:** slow queries, connection-pool saturation, or synchronous work that belongs in a worker. Add indexes / raise pool size, and keep real AI provider calls in the AI worker path, never in request handlers.

### AgentOpsApiProcessMemoryHigh (warning)

- **Means:** API resident memory is above 400 MB for 10 minutes.
- **First checks:** AgentOps - API and Workers (RED) dashboard process memory; `kubectl -n agentops top pod -l app=agentops-api`; heap growth over time.
- **Causes / action:** a leak or an unbounded in-memory cache. Confirm the container memory limit and restart the pod to clear the immediate pressure, then investigate the allocation path; if it correlates with a deploy, roll back.

### AgentOpsAlertBotInactive (info)

- **Means:** the alert bot metric `agentops_alertmanager_notifications_total` is absent — Alertmanager has not delivered anything yet, or delivery is misconfigured.
- **First checks:** Alertmanager UI (`/api/v2/alerts`); API `/notifications/alertmanager` endpoint; `ALERT_BOT_WEBHOOK_URL`; AgentOps Overview dashboard for the notifications counter.
- **Causes / action:** Alertmanager route/target misconfigured, or simply no alerts have fired yet. Send a test alert from Alertmanager and confirm the API increments `agentops_alertmanager_notifications_total`.

### AgentOpsWorkerDown (warning)

- **Means:** Prometheus cannot scrape a worker metrics endpoint for 2 minutes.
- **First checks:** AgentOps - API and Workers (RED) dashboard; `kubectl -n agentops get pods` for the named worker; pod logs; metrics port (`4101`–`4104`).
- **Causes / action:** crash, bad deploy, or unreachable metrics port. Check the last logs for a startup error, then restart or roll back that worker Deployment.

### AgentOpsWorkerErrors (warning)

- **Means:** a worker recorded Kafka processing errors in the last 5 minutes (`agentops_worker_errors_total`).
- **First checks:** AgentOps - API and Workers (RED) dashboard per worker; worker logs by `workflowRunId` / `eventId`; Tempo consumer span.
- **Causes / action:** a transient dependency error or a poison message. If it is a single `eventId`, inspect the payload and `dead-letter-events`; repeated errors point at the downstream dependency (DB, provider, Kafka).

### AgentOpsWorkerNoMessages (info)

- **Means:** a worker has not consumed from its topic for more than 15 minutes.
- **First checks:** AgentOps - Kafka dashboard; `kubectl -n agentops get pods`; that the producer side is active; `agentops_worker_last_message_timestamp_seconds` for `topic`.
- **Causes / action:** usually idle/low traffic (benign). If traffic is expected, the producer is stuck (often the API outbox — see `AgentOpsOutboxBacklog`) or the consumer is not subscribed. Check topic and consumer-group membership.

### AgentOpsKafkaConsumerLagHigh (warning)

- **Means:** a consumer group has more than 100 pending messages on a topic for 5 minutes.
- **First checks:** AgentOps - Kafka dashboard by `group_id`/`topic`; AgentOps - API and Workers (RED) dashboard throughput; worker CPU.
- **Causes / action:** burst of work or slow processing. Scale the affected worker (see `AgentOpsKafkaLagGrowing`); if a single partition is skewed, check the key distribution / hot lead.

### AgentOpsWorkerErrorRateHigh (warning)

- **Means:** more than 5% of a worker's messages are dead-lettered over 5 minutes (failed after 3 attempts).
- **First checks:** AgentOps - API and Workers (RED) dashboard; `dead-letter-events`; worker logs by `eventId` / `workflowRunId`.
- **Causes / action:** a bad payload or a broken dependency. Inspect the dead-letter event, fix the cause (code, config, or prompt), then re-trigger the affected workflow run.

### AgentOpsWorkerLatencyP95High (warning)

- **Means:** p95 message handling for a worker is above 10s for 10 minutes.
- **First checks:** AgentOps - AI dashboard (provider latency); AgentOps - API and Workers (RED) dashboard; Tempo traces slow spans.
- **Causes / action:** slow provider calls (AI/tool) or slow database writes. Check provider status and timeouts; verify the AI worker retry/`retryLimit` is not amplifying latency.

### AgentOpsKafkaLagGrowing (warning)

- **Means:** consumer lag is positive in derivative and above 10 for 10 minutes — consumers are falling behind.
- **First checks:** AgentOps - Kafka dashboard (lag trend); AgentOps - API and Workers (RED) dashboard; partition count.
- **Causes / action:** not enough consumers for the partitions. Scale the worker HPA up to the partition count (local topics default to 3 partitions, so 3 replicas max useful) before adding more; then check for a stuck partition / poison message.

### AgentOpsDeadLettersIncreasing (warning)

- **Means:** a message failed 3 attempts (or hit a non-retryable error) and was sent to `dead-letter-events`; its run is `FAILED`.
- **First checks:** `dead-letter-events` topic (key by `workflowRunId` / `eventId`); worker logs; the run's step timeline via `GET /workflow-runs/:id/steps`.
- **Causes / action:** inspect the dead-letter event payload and error, fix the root cause (validation, provider, or config), then re-trigger the run. Do not replay blindly — find the cause first.

### AgentOpsAiQuotaExhausted (warning)

- **Means:** AI calls are being rejected by `AI_DAILY_CALL_LIMIT` / `AI_DAILY_TOKEN_LIMIT`; new leads fail at the scoring step.
- **First checks:** AgentOps - AI dashboard; `GET /ai/usage`; AI worker logs for `quota_exceeded`.
- **Causes / action:** raise `AI_DAILY_CALL_LIMIT` and/or `AI_DAILY_TOKEN_LIMIT` for the workspace, or wait for the daily reset. Confirm the traffic is legitimate (not a runaway loop) before raising the limit.

### AgentOpsAiInvalidJsonHigh (warning)

- **Means:** more than 20% of AI outputs fail JSON Schema validation over 15 minutes.
- **First checks:** AgentOps - AI dashboard (`agentops_ai_output_validation_total{result="invalid"}`); the failing outputs in AI worker logs by `workflowRunId`; the prompt and schema.
- **Causes / action:** prompt/model drift or a schema change. Run the golden set (`POST /ai/evaluate-agent`, or `pnpm eval:leads`) to compare pass rate, then adjust the prompt or model and re-run before shipping.

### AgentOpsOutboxBacklog (warning)

- **Means:** the API has `agentops_domain_events_unpublished > 0` for 5 minutes — stored events could not be published to Kafka; the relay retries every 30s.
- **First checks:** AgentOps - Kafka dashboard; API logs for relay/publish errors; `/health/ready` (Kafka); broker reachability from the API.
- **Causes / action:** Kafka connectivity or auth problem. Check brokers, credentials, and the `domain_events` rows with a non-null `kafkaError`; once Kafka is reachable the 30s relay drains the backlog on its own.

### AgentOpsApprovalsBacklog (info)

- **Means:** more than 20 emails are waiting for a reviewer for 30 minutes.
- **First checks:** `/approvals` page; `GET /workflow-runs/approvals?status=WAITING_APPROVAL`; AgentOps - Lead flow dashboard for pending approvals.
- **Causes / action:** nobody is reviewing. Approve or reject the pending runs in `/approvals`; if the queue is expected, add reviewers.

## 429 Too Many Requests

Check whether one client or everyone is affected (API logs, client IPs). If everyone is limited, `API_TRUST_PROXY` is likely missing behind the ingress; set it to the proxy hop count (e.g. `1` behind ingress-nginx, never `true`). For load tests only, raise `API_RATE_LIMIT_PER_MINUTE` temporarily and restore it afterwards.

## Common Tasks

### Run the golden set after a prompt change

Prompts live in `packages/shared/src/ai.ts`. After editing any prompt, run the labeled dataset and compare the pass rate before merging:

```bash
pnpm eval:leads                       # labeled lead dataset
# or, against a running API:
curl -X POST http://localhost:4000/ai/evaluate-agent -H 'Content-Type: application/json' -d '{}'
```

`POST /ai/evaluate-agent` with an empty body runs the 24-lead `leadEvaluationCases` set and returns `passRate` plus mismatches. Treat a lower pass rate as a regression.

### Rotate JWT secrets

1. Generate a new secret and write it to AWS Secrets Manager (the secret backing `JWT_ACCESS_SECRET` / refresh signing).
2. Let External Secrets refresh the Kubernetes Secret (or force a reconcile) so `agentops-api` picks up the new value.
3. Restart the API so the new secret is loaded: `kubectl -n agentops rollout restart deploy/agentops-api`.
4. Existing access tokens expire naturally; users refresh with rotation. Keep the old secret until access tokens have aged out if you need overlap.

### Approve stuck emails

Open `/approvals`, review the pending runs, and approve or reject. Each decision writes an `AuditLog` row; the first decision wins and later calls return `409`. Approving publishes `human-approval-decided`; rejecting fails the step and cancels the run.

### Read a run end to end

1. Find the `requestId` from the triggering HTTP response or API logs.
2. Jump to the `workflowRunId` via `GET /workflow-runs/:id` and `GET /workflow-runs/:id/steps` (or the run page in the web app).
3. In Grafana → Tempo, search traces by `workflowRunId` (or by `traceId`) to follow the api → Kafka → worker spans.
4. In the log backend, filter by `requestId`, `workflowRunId`, `traceId`, and `eventId` to line up the HTTP request, published events, and each worker's handling.
