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
```

## Trace Correlation

The API accepts or creates a W3C `traceparent` header, starts an OpenTelemetry server span when OTel is enabled, and mirrors the active trace into Kafka event envelopes. Workers start OpenTelemetry consumer spans around Kafka message handling and propagate child `traceparent` values into downstream events.

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
