# Deployment

Deployment is planned in layers: local infrastructure, containers, Kubernetes, Terraform, then CI/CD automation.

## Local

- Use `docker-compose.yml` for PostgreSQL, Redis, Kafka, and observability.
- Use `docker-compose.apps.yml` together with `docker-compose.yml` for the full local product stack.
- Start the full seeded local stack with `pnpm local:docker`.
- Reset Docker volumes and reseed the full local stack with `pnpm compose:apps:reset`.
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

## Containers

Each app image is a multi-stage build (node:22-alpine + pnpm 11.5.2) that ships only the app's `dist/` and production `node_modules`. Runners use non-root `node` (uid 1000), `tini` as PID 1, and a HEALTHCHECK on `/health/live` (api `:4000`, workers `:9100`, web `:3000/en`). `api.Dockerfile --target tools` builds the full workspace with dev deps for the compose `setup` service and the Kubernetes `agentops-db-migrate` Job. See `infrastructure/docker/README.md`.

## Kubernetes

Manifests are kustomize base + components + overlays. Workloads: `agentops-api` (4000), `agentops-web` (3000), `workflow-worker`, `ai-worker`, `tool-worker`, `notification-worker` (metrics 9100). `components/in-cluster-data/` provides Postgres, Redis, and Kafka for dev/k3s; `overlays/prod` uses managed MSK/ElastiCache.

Validate with `pnpm k8s:validate` (kustomize v5.6.0 + kubeconform v0.6.7). Deploy order:

1. Install ingress-nginx, cert-manager, and External Secrets (plus KEDA for prod, see [Autoscaling](#autoscaling)).
2. Create the secret in AWS Secrets Manager.
3. `kubectl apply -k infrastructure/k8s/jobs/db-migrate` with the overlay's image.
4. `kubectl apply -k infrastructure/k8s/overlays/<env>`.

## Autoscaling

Load-test facts (1000 leads, 20 VUs, mock AI provider):

| Worker replicas | Drain rate |
| --- | --- |
| 1 | 8.2 runs/s |
| 3 | 12.2 runs/s |

Intake is about 30 req/s, so a single replica - and even three - cannot keep up and Kafka lag grows. Two scalers exist:

- **CPU HPA** (`infrastructure/k8s/base/hpa.yaml`): every worker requests `50m` CPU (the `ai-worker` requests `100m`) and scales at 75% utilization. CPU is only a proxy for the backlog: a worker can be idle on CPU while its topic lags, and a CPU spike does not mean messages are waiting. The API keeps a CPU HPA (2-6 replicas in prod) because it serves HTTP traffic.
- **KEDA lag scaling** (`infrastructure/k8s/components/keda-autoscaling/`, prod only): one `ScaledObject` per worker with a Kafka trigger per consumed topic, `lagThreshold: "50"`, `minReplicaCount: 1`, `maxReplicaCount: 6`, `pollingInterval: 15`, `cooldownPeriod: 120`, and a 120s scale-down stabilization window. KEDA creates the HPA itself, so the component deletes the four worker HPAs from the base; the API HPA stays CPU-based.

KEDA must be installed in the cluster before the prod overlay is applied:

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda --namespace keda --create-namespace
```

Partitions cap the useful replica count: a partition is consumed by exactly one consumer in a group, so the useful replicas of a worker are bounded by the partition count (3 by default, 6 in prod once the topics are increased).

To raise the partition count of an existing cluster:

```bash
KAFKA_BROKERS=<msk-brokers> KAFKA_TOPIC_PARTITIONS=6 KAFKA_TOPIC_ALLOW_INCREASE=true pnpm kafka:bootstrap
```

`KAFKA_TOPIC_PARTITIONS` (default 3) sets the partition count for new topics. `KAFKA_TOPIC_ALLOW_INCREASE=true` is opt-in: the bootstrap script increases existing topics up to the target and logs each change; it never decreases partitions. Increasing partitions is irreversible (Kafka cannot shrink a topic), and per-key ordering is unaffected because messages are keyed by workflow run id, so every run stays on a single partition. The prod overlay records the intent in the `agentops-config` ConfigMap (`KAFKA_TOPIC_PARTITIONS: "6"`), but the count only changes when the bootstrap script runs against the cluster.

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

GitHub Actions workflows live in `.github/workflows/`; see `.github/workflows/README.md` for the workflow list and the required repository variables, secret, environments, and branch protection.

The flow is:

1. **PR -> main checks.** A pull request must pass `ci.yml` (quality, integration, security, infra, image scans). Terraform changes also get a `terraform-plan.yml` comment per environment.
2. **Dev auto deploy.** A merge to `main` triggers `deploy-dev.yml`: build and push the commit-tagged images to `dev/<app>`, run the migration Job, roll out, smoke test, and automatically roll back on failure.
3. **Manual prod promotion with approval.** `deploy-prod.yml` is dispatched with a tested tag, pauses on the `production` environment's required reviewers, promotes the images without rebuilding, and deploys with the same script.
4. **Rollback.** `scripts/k8s-deploy.sh` rolls every Deployment back to its previous revision if a rollout or smoke test fails.

Terraform is applied separately with `terraform-apply.yml` (manual, per-environment approval).

Validate the workflow files locally with `pnpm ci:lint` (actionlint + shellcheck).
