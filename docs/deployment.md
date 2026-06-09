# Deployment

Deployment is planned in layers: local infrastructure, containers, Kubernetes, Terraform, then CI/CD automation.

## Local

- Use `docker-compose.yml` for PostgreSQL, Redis, and Kafka.
- Add app Dockerfiles after the web/API/worker code exists.
- Keep local ports stable: web `3000`, API `4000`, PostgreSQL host `55432`, Kafka external `9094`, Prometheus `9090`, Alertmanager `9093`, Grafana `3001`, Tempo `3200`, OTLP gRPC `4317`, and OTLP HTTP `4318`.

## Naming

| Resource | Pattern | Example |
| --- | --- | --- |
| Local container | `agentops-local-<service>` | `agentops-local-kafka` |
| Local volume | `agentops_local_<service>_data` | `agentops_local_redis_data` |
| Local network | `agentops_local_net` | `agentops_local_net` |
| Local app image | `agentops/<app>:local` | `agentops/ai-worker:local` |
| ECR repository | `<env-name>/<app>` | `agentops-dev/ai-worker` |

Local infrastructure containers:

```txt
agentops-local-postgres
agentops-local-redis
agentops-local-kafka
agentops-local-prometheus
agentops-local-alertmanager
agentops-local-grafana
agentops-local-tempo
```

## Kubernetes Workloads

```txt
frontend
api-backend
workflow-worker
ai-worker
tool-worker
notification-worker
postgres
redis
kafka
```

## Kubernetes Resources

- Deployment
- Service
- Ingress
- ConfigMap
- Secret
- PersistentVolumeClaim
- HorizontalPodAutoscaler

## Health Checks

The API exposes:

```txt
GET /health/live
GET /health/ready
```

`/health/live` reports API process liveness. `/health/ready` uses NestJS Terminus to verify PostgreSQL, Redis, and Kafka before the API is considered ready for traffic.

Worker health should include process liveness and dependency readiness where practical.

## Metrics And Alerting

The API exposes:

```txt
GET /metrics
```

Each worker exposes:

```txt
GET /metrics
GET /health/live
```

Default worker metrics ports:

| Worker | Env var | Port |
| --- | --- | --- |
| workflow-worker | `WORKFLOW_WORKER_METRICS_PORT` | `4101` |
| ai-worker | `AI_WORKER_METRICS_PORT` | `4102` |
| tool-worker | `TOOL_WORKER_METRICS_PORT` | `4103` |
| notification-worker | `NOTIFICATION_WORKER_METRICS_PORT` | `4104` |

Local Prometheus scrapes the API and workers through Docker host networking:

```txt
host.docker.internal:4000
host.docker.internal:4101
host.docker.internal:4102
host.docker.internal:4103
host.docker.internal:4104
```

API metrics include HTTP request counters/histograms, workflow run totals, alert bot notifications, process gauges, and Kafka consumer lag. Worker metrics include consumed messages, processing duration, processing errors, last-message timestamps, and process gauges.

Alertmanager posts firing/resolved alerts to the API alert bot endpoint:

```txt
POST /notifications/alertmanager
```

Set `ALERT_BOT_WEBHOOK_URL` to forward those alerts to an external bot webhook. Keep bot tokens and chat-specific URLs out of source control.

HTTP requests carry `x-request-id` and W3C `traceparent`. API-published Kafka events carry `requestId`, `traceId`, `traceparent`, and downstream `parentEventId` so logs, traces, and workflow execution can be correlated by `requestId`, `workflowRunId`, and `eventId`.

OpenTelemetry trace export is opt-in:

```txt
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
```

The local Docker Compose stack includes Tempo. Grafana has a provisioned Tempo datasource so exported API and worker spans can be queried by trace ID.

## Terraform

Recommended personal-project path:

```txt
AWS EC2 + k3s + Security Group + Elastic IP optional + S3 state bucket optional
```

More expensive advanced path:

```txt
AWS EKS + VPC + Node Group + ECR + RDS + ElastiCache + ALB
```

## CI/CD

Pull requests:

- Install dependencies
- Run lint
- Run unit tests
- Run typecheck
- Build affected apps

Main branch:

- Build Docker images
- Push images
- Run Terraform plan
- Deploy Kubernetes manifests after approval
- Run smoke tests
