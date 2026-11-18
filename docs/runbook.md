# Operations and Incident Runbook

This runbook provides actionable procedures and diagnostic workflows for triaging alerts and resolving incidents in AgentOps. It is designed for engineers and on-call operators maintaining the platform in production (AWS EKS) and local environments.

Related documentation:
- [Production Runbook (AWS)](production-runbook-aws.md): Environment lifecycle, credentials, and verification.
- [Deployment and CI/CD](deployment.md): Rollback execution and container lifecycle.
- [Local Runbook](local-runbook.md): Local infrastructure and debugging commands.

---

## 1. Observability and Triaging Framework

### Correlation Identifiers
AgentOps propagates correlation metadata across synchronous HTTP calls and asynchronous Kafka events. Use these keys when searching logs, metrics, and distributed traces:

| Identifier | Context / Scope | Where Found | Purpose |
| --- | --- | --- | --- |
| `requestId` | Single HTTP request | Response header `x-request-id`, API log entries | Isolates user-facing API failures |
| `traceId` / `traceparent` | End-to-end W3C distributed trace | HTTP headers, Kafka event envelope, OpenTelemetry spans | Links API span across Kafka into worker execution in Tempo |
| `workflowRunId` | One workflow execution instance | Database table `WorkflowRun.id`, Kafka message key | Follows an execution from trigger to terminal status |
| `eventId` | Individual domain event | Database table `DomainEvent.id`, Kafka envelope | Identifies specific messages and dead-letter records |

### Diagnostic Dashboards (Grafana)
Access in-cluster Grafana via port-forward (`kubectl -n monitoring port-forward svc/grafana 3002:3000`):
- **AgentOps - Overview**: Platform-level request rates, p95 latencies, 5xx error ratios, and active alerts.
- **AgentOps - RED (API and Workers)**: Rate, Errors, and Duration for API endpoints and Kafka consumers.
- **AgentOps - Kafka**: Consumer lag by consumer group and topic, outbox relay backlog, and dead-letter trends.
- **AgentOps - AI**: Provider latency, JSON schema validation success rate, token consumption, and daily quota utilization.
- **AgentOps - Lead Flow (Business)**: Lead scoring funnel, approval wait times, and sales task generation.

---

## 2. Prometheus Alert Rules Catalog

Alert rules are defined in `infrastructure/observability/prometheus/rules/agentops-alerts.yml` (17 rules across 5 groups):

| Group | Alert Name | Severity | Condition / Trigger Threshold |
| --- | --- | --- | --- |
| `agentops-api` | `AgentOpsApiDown` | Critical | `up{job="agentops-api"} == 0` for > 1m |
| `agentops-api` | `AgentOpsApiHighErrorRate` | Warning | 5xx responses > 5% of API traffic over 5m |
| `agentops-api` | `AgentOpsApiHighLatencyP95` | Warning | API p95 response time > 1.0s over 5m |
| `agentops-api` | `AgentOpsApiProcessMemoryHigh`| Warning | Resident memory (RSS) > 400 MB for > 10m |
| `agentops-alert-bot` | `AgentOpsAlertBotInactive` | Info | `agentops_alertmanager_notifications_total` metric absent for > 10m |
| `agentops-workers` | `AgentOpsWorkerDown` | Warning | Worker `/metrics` scrape failure (`up == 0`) for > 2m |
| `agentops-workers` | `AgentOpsWorkerErrors` | Warning | Kafka processing errors recorded (`rate > 0`) over 5m |
| `agentops-workers` | `AgentOpsWorkerNoMessages` | Info | Consumer idle: no messages consumed from topic for > 15m |
| `agentops-kafka` | `AgentOpsKafkaConsumerLagHigh`| Warning | Consumer group lag > 100 pending messages for > 5m |
| `agentops-pipeline` | `AgentOpsWorkerErrorRateHigh` | Warning | Dead-lettered messages > 5% of consumer volume over 5m |
| `agentops-pipeline` | `AgentOpsWorkerLatencyP95High`| Warning | Worker p95 message handling duration > 10s for > 10m |
| `agentops-pipeline` | `AgentOpsKafkaLagGrowing` | Warning | Positive derivative (`deriv > 0`) and lag > 10 for > 10m |
| `agentops-pipeline` | `AgentOpsDeadLettersIncreasing`| Warning | Any message routed to `dead-letter-events` within 10m |
| `agentops-pipeline` | `AgentOpsAiQuotaExhausted` | Warning | AI calls rejected by `AI_DAILY_CALL_LIMIT` / token limits |
| `agentops-pipeline` | `AgentOpsAiInvalidJsonHigh` | Warning | AI output JSON schema validation failure rate > 20% over 15m |
| `agentops-pipeline` | `AgentOpsOutboxBacklog` | Warning | Unpublished domain events (`count > 0`) for > 5m |
| `agentops-pipeline` | `AgentOpsApprovalsBacklog` | Info | More than 20 approval requests pending for > 30m |

---

## 3. Incident Playbooks

### Playbook 1: API 5xx and High Error Rate (`AgentOpsApiHighErrorRate`, `AgentOpsApiDown`)

#### Symptoms
- Alert `AgentOpsApiHighErrorRate` or `AgentOpsApiDown` firing.
- Ingress returning HTTP 502/503 or API responses returning 500.

#### Immediate Triage Steps
```bash
# 1. Inspect API deployment pod status and restarts
kubectl -n agentops get pods -l app=agentops-api -o wide

# 2. Check recent application logs for unhandled exceptions or connection errors
kubectl -n agentops logs -l app=agentops-api --tail=100 | grep -iE "error|exception|fatal"

# 3. Check readiness probe dependencies (PostgreSQL, Redis, Kafka)
kubectl -n agentops exec deploy/agentops-api -c agentops-api -- wget -qO- http://localhost:4000/health/ready
```

#### Common Causes and Mitigation
1. **Database or Cache Saturation**:
   - If `/health/ready` indicates PostgreSQL is down or connection pool exhausted:
     ```bash
     kubectl -n agentops logs -l app=agentops-api | grep "PrismaClientKnownRequestError"
     ```
   - Check RDS CPU and connection metrics in AWS Console. Restart API deployment to cycle connection pools:
     ```bash
     kubectl -n agentops rollout restart deploy/agentops-api
     ```
2. **Corrupted or Incompatible Deployment**:
   - If errors correlate with a fresh image rollout, execute an immediate rollback:
     ```bash
     kubectl -n agentops rollout undo deploy/agentops-api
     kubectl -n agentops rollout status deploy/agentops-api
     ```

---

### Playbook 2: Worker Consumer Lag & Backlog (`AgentOpsKafkaConsumerLagHigh`, `AgentOpsKafkaLagGrowing`)

#### Symptoms
- Alert `AgentOpsKafkaConsumerLagHigh` (lag > 100) or `AgentOpsKafkaLagGrowing` firing.
- Workflow runs remain in `PENDING` or steps do not advance to subsequent nodes.

#### Immediate Triage Steps
```bash
# 1. Check KEDA ScaledObject and HPA status for the affected worker
kubectl -n agentops get scaledobjects
kubectl -n agentops get hpa

# 2. Check worker pod replica counts and CPU/memory utilization
kubectl -n agentops get pods -l component=worker
kubectl -n agentops top pods -l component=worker

# 3. Inspect worker logs for consumer group rebalancing or processing stalls
kubectl -n agentops logs deploy/workflow-worker --tail=100
```

#### Common Causes and Mitigation
1. **Surge in Inbound Leads**:
   - Verify that KEDA has scaled replicas up toward the max limit (6).
   - If replicas are capped at 3 due to topic partition constraints, check topic partition count:
     ```bash
     kubectl -n agentops exec deploy/agentops-api -- node -e "
       const { Kafka } = require('kafkajs');
       const k = new Kafka({ brokers: [process.env.KAFKA_BROKERS] });
       k.admin().connect().then(a => a.fetchTopicMetadata({ topics: ['workflow-triggered'] })).then(console.log);
     "
     ```
   - Expand topic partitions to 6 if needed (see SOP 3).
2. **Poison Message / Consumer Rebalance Loop**:
   - If consumer errors are repeated on a single `eventId`, inspect `dead-letter-events` to identify the failing payload:
     ```bash
     kubectl -n agentops logs deploy/workflow-worker | grep "dead_lettered"
     ```

---

### Playbook 3: AI Quota Exhaustion & Provider Outage (`AgentOpsAiQuotaExhausted`, `AgentOpsWorkerErrorRateHigh`)

#### Symptoms
- Alert `AgentOpsAiQuotaExhausted` firing; new lead runs fail at step `ai-1` with `Daily AI quota reached`.
- Or upstream AI provider (OpenAI) returns 500/503; worker retries 3 times before dead-lettering.

#### Immediate Triage Steps
```bash
# 1. Query current workspace AI usage
kubectl -n agentops exec deploy/agentops-api -- node -e "
  // Fetches current usage record from PostgreSQL
"

# 2. Inspect AI worker logs for quota or provider error codes
kubectl -n agentops logs deploy/ai-worker --tail=100 | grep -E "quota_exceeded|OpenAI|rate_limit"
```

#### Common Causes and Mitigation
1. **Daily Quota Reached**:
   - Confirm if traffic is legitimate inbound volume or an automated loop.
   - If legitimate, raise workspace limits via environment variables or Secrets Manager:
     - `AI_DAILY_CALL_LIMIT` (e.g. increase from 100 to 500).
     - `AI_DAILY_TOKEN_LIMIT` (e.g. increase from 200,000 to 1,000,000).
   - Restart the API and AI worker to apply limits immediately:
     ```bash
     kubectl -n agentops rollout restart deploy/ai-worker deploy/agentops-api
     ```
2. **Upstream Provider Outage (OpenAI 5xx)**:
   - For temporary testing or fallback, switch model provider to `mock` in workflow node configuration.
   - Verified runs that fail after 3 retries transition to `FAILED` and record an `AuditLog` row.

---

### Playbook 4: Kafka Down & Outbox Backlog (`AgentOpsOutboxBacklog`)

#### Symptoms
- Alert `AgentOpsOutboxBacklog` firing (`agentops_domain_events_unpublished > 0` for > 5m).
- Inbound API requests succeed, but downstream workflow steps never trigger.

#### Immediate Triage Steps
```bash
# 1. Check Kafka broker connectivity from API
kubectl -n agentops exec deploy/agentops-api -c agentops-api -- wget -qO- http://localhost:4000/health/ready

# 2. Check unpublished events count in PostgreSQL
kubectl -n agentops exec deploy/agentops-api -- node -e "
  const { PrismaClient } = require('@agentops/database');
  const prisma = new PrismaClient();
  prisma.domainEvent.count({ where: { publishedToKafka: false } }).then(c => console.log('Unpublished events:', c));
"

# 3. Inspect API domain event outbox relay logs
kubectl -n agentops logs -l app=agentops-api | grep "relay"
```

#### Common Causes and Mitigation
1. **Broker Authentication / Network Disruption**:
   - Check AWS MSK cluster status in AWS Console (`ap-southeast-1`).
   - If brokers rotated or security group modified, verify `KAFKA_BROKERS` string in `agentops-config`.
2. **Automatic Relay Recovery**:
   - The API incorporates a background outbox relay running every 30 seconds. Once Kafka connectivity is restored, the relay automatically publishes pending rows in FIFO order. No manual SQL intervention is required.

---

### Playbook 5: Stuck Human Approvals (`AgentOpsApprovalsBacklog`)

#### Symptoms
- Alert `AgentOpsApprovalsBacklog` firing (more than 20 emails waiting for review for > 30m).
- High-intent leads stalled at the `approval-1` workflow step.

#### Immediate Triage Steps
```bash
# 1. Inspect pending approval count via API
curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.agentops.<host>/workflow-runs/approvals?status=WAITING_APPROVAL" | jq '. | length'

# 2. Check for orphaned runs where approval step was skipped or mismatched
kubectl -n agentops exec deploy/agentops-api -- node -e "
  const { PrismaClient } = require('@agentops/database');
  const prisma = new PrismaClient();
  prisma.humanApproval.findMany({ where: { status: 'WAITING_APPROVAL' }, take: 5 }).then(console.log);
"
```

#### Mitigation
1. **Reviewer Team Notification**: Notify authorized reviewers (users with OWNER, ADMIN, or MEMBER roles in the workspace) to review pending drafts at `https://agentops.<host>/approvals`.
2. **Programmatic Resolution (Batch Approval/Rejection)**:
   - Reviewers can approve via REST API:
     ```bash
     curl -X POST "https://api.agentops.<host>/workflow-runs/<runId>/steps/<runId>_approval-1/approval" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"decision": "approve", "comment": "Batch approved by on-call operator"}'
     ```
   - Remember: The first decision wins. Duplicate decision attempts return `409 Conflict`.

---

### Playbook 6: Disabled Account and Security Lockout Response

#### Context
A platform administrator can disable any account via `/admin` (Accounts tab). Disabling an account sets `disabledAt` in the database, revokes all active refresh tokens, and causes the JWT authentication guard to reject subsequent requests with HTTP 403 immediately.

#### Emergency Recovery / Lockout Resolution
Admins cannot disable their own accounts in the UI (`TC-SEC-04`). If an admin account was disabled in error by another administrator:

```bash
# 1. Verify user status in database
kubectl -n agentops exec deploy/agentops-api -- node -e "
  const { PrismaClient } = require('@agentops/database');
  const prisma = new PrismaClient();
  prisma.user.findUnique({ where: { email: 'operator@agentops.local' } }).then(console.log);
"

# 2. Re-enable account directly via script if web admin console is inaccessible
kubectl -n agentops exec deploy/agentops-api -- node -e "
  const { PrismaClient } = require('@agentops/database');
  const prisma = new PrismaClient();
  prisma.user.update({
    where: { email: 'operator@agentops.local' },
    data: { disabledAt: null }
  }).then(u => console.log('Account re-enabled:', u.email));
"
```

---

### Playbook 7: Alert Bot Silent (`AgentOpsAlertBotInactive`)

#### Symptoms
- Alert `AgentOpsAlertBotInactive` firing (info).
- Alertmanager is not delivering alerts, or `POST /notifications/alertmanager` is rejecting deliveries.

#### Immediate Triage Steps
```bash
# 1. Verify Alertmanager pod status in monitoring namespace
kubectl -n monitoring get pods -l app=alertmanager

# 2. Check Alertmanager webhook configuration
kubectl -n monitoring exec deploy/alertmanager -- cat /etc/alertmanager/alertmanager.yml

# 3. Trigger a synthetic test alert probe to verify the end-to-end webhook path
kubectl -n monitoring exec deploy/alertmanager -- wget -qO- \
  --header='Content-Type: application/json' \
  --post-data='[{"labels":{"alertname":"AgentOpsManualProbe","severity":"info","service":"runbook"}}]' \
  http://localhost:9093/api/v2/alerts

# 4. Check API metrics to confirm counter increment
kubectl -n agentops exec deploy/agentops-api -c agentops-api -- wget -qO- http://localhost:4000/metrics | grep agentops_alertmanager_notifications_total
```

#### Mitigation
- If Alertmanager receives HTTP 401/403 from the API, ensure `ALERTMANAGER_WEBHOOK_TOKEN` in Kubernetes Secret `alertmanager-webhook` exactly matches the value in `agentops-secrets`.

---

## 4. Standard Operational Procedures (SOPs)

### SOP 1: Running the Lead Evaluation Golden Set
Execute the golden set evaluation after making any prompt adjustments or model configuration updates:

```bash
# Run locally against mock provider:
pnpm eval:leads

# Or invoke directly against running API endpoint:
curl -X POST http://localhost:4000/ai/evaluate-agent \
  -H "Content-Type: application/json" \
  -d '{}'
```
*Acceptance gate: Accuracy must be >= 0.90, hot-lead miss rate <= 0.10, schema validity = 1.0.*

### SOP 2: Rotating JWT Signing Secrets
1. Generate new 32-byte cryptographically secure random keys.
2. Update `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in AWS Secrets Manager container `agentops/prod/app`.
3. Force External Secrets Operator reconciliation:
   ```bash
   kubectl -n agentops annotate es agentops-secrets force-sync=$(date +%s) --overwrite
   ```
4. Perform rolling restart of the API deployment:
   ```bash
   kubectl -n agentops rollout restart deploy/agentops-api
   ```
   *Active access tokens (15m TTL) expire naturally; refreshed tokens re-sign against new secrets.*

### SOP 3: Expanding Kafka Topic Partitions
To permit increased consumer parallelism:

```bash
KAFKA_BROKERS=<msk-brokers> KAFKA_TOPIC_PARTITIONS=6 KAFKA_TOPIC_ALLOW_INCREASE=true pnpm kafka:bootstrap
```

### SOP 4: Investigating Dead-Letter Messages
When `AgentOpsDeadLettersIncreasing` fires, query the `dead-letter-events` topic:

```bash
kubectl -n agentops exec deploy/workflow-worker -- node -e "
  const { PrismaClient } = require('@agentops/database');
  const prisma = new PrismaClient();
  prisma.processedMessage.findMany({
    where: { outcome: 'dead_lettered' },
    orderBy: { createdAt: 'desc' },
    take: 5
  }).then(console.log);
"
```
Fix underlying prompt or validation errors before re-submitting the workflow run.
