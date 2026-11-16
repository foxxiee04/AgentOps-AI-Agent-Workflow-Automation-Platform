# Observability

Observability should make workflow execution debuggable.

## Signals

- Structured API logs with `requestId` and `traceId`.
- Worker logs with `eventId`, `workflowRunId`, `requestId`, and `traceId`.
- Workflow run logs and step logs in the dashboard.
- Health check endpoints for API and workers.
- Prometheus metrics for API HTTP traffic, workflow runs, alert bot notifications, worker processing, and Kafka lag.
- OpenTelemetry traces exported to Tempo when OTel is enabled.
- Grafana dashboard and trace explorer backed by provisioned Prometheus and Tempo datasources.

## Local Stack

Docker Compose includes the local observability stack:

| Service | URL | Purpose |
| --- | --- | --- |
| Prometheus | `http://localhost:9090` | Scrapes `http://host.docker.internal:4000/metrics` and evaluates AgentOps alert rules. |
| Alertmanager | `http://localhost:9093` | Groups alerts and sends them to the AgentOps alert bot webhook. |
| Grafana | `http://localhost:3001` | Uses the provisioned Prometheus datasource and AgentOps overview dashboard. Login: `agentops` / `agentops`. |
| Tempo | `http://localhost:3200` | Stores local OpenTelemetry traces. Apps export OTLP HTTP to `http://localhost:4318/v1/traces`. |

Prometheus scrapes these host targets:

| Job | Target | Notes |
| --- | --- | --- |
| `agentops-api` | `host.docker.internal:4000/metrics` | API HTTP/process/workflow/alert/Kafka lag metrics. |
| `agentops-workers` | `host.docker.internal:4101/metrics` | workflow-worker metrics. |
| `agentops-workers` | `host.docker.internal:4102/metrics` | ai-worker metrics. |
| `agentops-workers` | `host.docker.internal:4103/metrics` | tool-worker metrics. |
| `agentops-workers` | `host.docker.internal:4104/metrics` | notification-worker metrics. |

Alertmanager sends local alerts to:

```txt
POST http://host.docker.internal:4000/notifications/alertmanager
```

The API stores those alerts as in-app notifications. If `ALERT_BOT_WEBHOOK_URL` is set, the API also forwards a generic JSON payload with both `text` and `content` fields so Discord, Slack-style, or a small custom bot bridge can consume it.

## Alert Rules

Rules live in `infrastructure/observability/prometheus/rules/agentops-alerts.yml`.

Current rules:

- `AgentOpsApiDown`: Prometheus cannot scrape the API.
- `AgentOpsApiHighErrorRate`: API 5xx ratio is above 5%.
- `AgentOpsApiHighLatencyP95`: API p95 latency is above 1 second.
- `AgentOpsApiProcessMemoryHigh`: API resident memory is above 400 MB.
- `AgentOpsAlertBotInactive`: alert bot metric is absent, useful as a setup reminder.
- `AgentOpsWorkerDown`: Prometheus cannot scrape a worker metrics endpoint.
- `AgentOpsWorkerErrors`: a worker recorded Kafka processing errors.
- `AgentOpsWorkerNoMessages`: a worker has not consumed messages recently after previous activity.
- `AgentOpsKafkaConsumerLagHigh`: a consumer group has more than 100 pending messages on a topic.
- `AgentOpsWorkerErrorRateHigh`: more than 5% of a worker's messages are dead-lettered (5 min).
- `AgentOpsWorkerLatencyP95High`: worker p95 message handling above 10 s (10 min).
- `AgentOpsKafkaLagGrowing`: lag keeps increasing for 10 min and is above 10.
- `AgentOpsDeadLettersIncreasing`: any new dead letter (fires immediately).
- `AgentOpsAiQuotaExhausted`: AI calls rejected by the daily quota.
- `AgentOpsAiInvalidJsonHigh`: more than 20% of AI outputs fail JSON Schema validation (15 min).
- `AgentOpsOutboxBacklog`: domain events stored but not published to Kafka for 5 min.
- `AgentOpsApprovalsBacklog`: more than 20 emails waiting for review for 30 min.

Validate rules with `docker run --rm -v "$PWD/infrastructure/observability/prometheus:/p" --entrypoint promtool prom/prometheus:v3.8.0 check rules /p/rules/agentops-alerts.yml` (on Git Bash prefix `MSYS_NO_PATHCONV=1`).

Important metric names:

```txt
agentops_http_requests_total
agentops_http_request_duration_seconds
agentops_workflow_runs_total
agentops_alertmanager_notifications_total
agentops_kafka_consumer_lag
agentops_worker_messages_consumed_total
agentops_worker_message_duration_seconds
agentops_worker_errors_total
agentops_worker_message_outcomes_total{outcome=processed|duplicate|dead_lettered}
agentops_worker_dead_letters_total
agentops_kafka_topic_messages{topic="dead-letter-events"}
agentops_domain_events_unpublished
# AI (ai-worker)
agentops_ai_calls_total{provider,model,status=success|invalid_output|error|quota_exceeded}
agentops_ai_tokens_total{provider,model,direction=input|output}
agentops_ai_estimated_cost_usd_total{provider,model}      # estimate from aiModelPricingPerMillion
agentops_ai_output_validation_total{provider,model,result=valid|invalid}
agentops_ai_retries_total{provider,model}
agentops_ai_call_duration_seconds
# Lead flow (workflow-worker, notification-worker, API)
agentops_leads_scored_total{category}
agentops_workflow_branch_total{node_id,target}             # condition-1 -> ai-2 (A) / end-1 (B)
agentops_approvals_requested_total
agentops_approval_decisions_total{decision}
agentops_approvals_pending{workspace_id}
agentops_sales_tasks_created_total{kind}
```

Known label sets are created at 0 when a worker starts, so `increase()` also counts the first events after a restart.

## Dashboards

Provisioned from `grafana/dashboards` (folder "AgentOps"):

| Dashboard | Content |
| --- | --- |
| AgentOps - API and Workers (RED) | Throughput, error ratio, p50/p95/p99 for the API and each worker; duplicates skipped; memory. |
| AgentOps - AI | Calls by status, tokens in/out, estimated cost, valid JSON ratio, retries, latency, quota rejections. |
| AgentOps - Kafka | Consumer lag per group/topic, dead letters, message outcomes, outbox backlog. |
| AgentOps - Lead flow | Leads by category, branch A/B ratio, approvals requested vs decided, emails waiting, sales tasks. |
| AgentOps Overview | The original overview. |

## Load And Alert Check

```bash
node scripts/generate-leads.mjs 20 --approve   # 20 leads through wf_lead_qualification, approves the drafted emails
node scripts/generate-leads.mjs 0 --approve    # approve everything still waiting
```

A workflow whose AI node uses `modelProvider: "openai"` without `OPENAI_API_KEY` is dead-lettered on the first attempt (non-retryable), fails its run and fires `AgentOpsDeadLettersIncreasing` within one evaluation interval.

## Logs

Workers log with pino using `logRedactPaths` from `@agentops/observability`: `email`, `phone`, `input`, `context`, `authorization` and `apiKey` fields are replaced with `[REDACTED]`. Log lines carry `workflowRunId`, `eventId`, `requestId` and `traceId`; prompts and lead input are never logged.

## Trace Correlation

The API accepts or creates a W3C `traceparent` header, starts an OpenTelemetry server span when OTel is enabled, and mirrors the active trace into Kafka event envelopes. Workers start OpenTelemetry consumer spans around Kafka message handling and propagate child `traceparent` values into downstream events. The workflow-worker adds one `workflow.node <TYPE>` span per node it starts and the ai-worker an `ai.call` span (model, tokens, attempts), so one lead is one trace in Tempo: `HTTP POST /workflows/:workflowId/run` -> `kafka consume workflow-triggered` -> `workflow.node TRIGGER/AI_AGENT` -> `ai.call` -> `workflow.node CONDITION/...`.

With OTel disabled the envelope still carries the caller's trace id (never the all-zero noop id), so logs stay correlated.

Enable local trace export with:

```txt
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
```

Use these fields together:

| Field | Where | Purpose |
| --- | --- | --- |
| `requestId` | HTTP headers, API logs, Kafka events | User-facing request correlation. |
| `traceId` | `traceparent`, Kafka events, worker logs | Cross-process trace correlation. |
| `traceparent` | HTTP headers and Kafka events | W3C trace propagation into API and worker spans. |
| `workflowRunId` | workflow events, run records, worker logs | Business execution correlation. |
| `eventId` | Kafka events and worker logs | Exact event handling correlation. |
| `parentEventId` | child Kafka events | Causal chain between events. |
