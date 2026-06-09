# Docker

This folder will hold app Dockerfiles and containerization notes once source apps exist.

## Planned Images

- `agentops/web:local`
- `agentops/api:local`
- `agentops/workflow-worker:local`
- `agentops/ai-worker:local`
- `agentops/tool-worker:local`
- `agentops/notification-worker:local`

Local dependencies and observability services are already represented in the root `docker-compose.yml`.

| Service | Host port |
| --- | --- |
| PostgreSQL | `55432` |
| Redis | `6379` |
| Kafka | `9094` |
| Prometheus | `9090` |
| Alertmanager | `9093` |
| Grafana | `3001` |
| Tempo | `3200` |
| OTLP gRPC | `4317` |
| OTLP HTTP | `4318` |

App metrics endpoints are served by the apps themselves, while Prometheus runs in Docker Compose:

| Endpoint | Host port |
| --- | --- |
| API `/metrics` | `4000` |
| workflow-worker `/metrics` | `4101` |
| ai-worker `/metrics` | `4102` |
| tool-worker `/metrics` | `4103` |
| notification-worker `/metrics` | `4104` |

## Naming Convention

Use these names consistently:

| Resource | Pattern | Example |
| --- | --- | --- |
| Local container | `agentops-local-<service>` | `agentops-local-postgres` |
| Local volume | `agentops_local_<service>_data` | `agentops_local_kafka_data` |
| Local network | `agentops_local_net` | `agentops_local_net` |
| Local app image | `agentops/<app>:local` | `agentops/api:local` |
| AWS ECR repository | `<env-name>/<app>` | `agentops-dev/api` |

## Dockerfiles

- `web.Dockerfile`: builds and runs `@agentops/web`.
- `api.Dockerfile`: builds and runs `@agentops/api`.
- `worker.Dockerfile`: generic worker image; pass `WORKER_PACKAGE` and `WORKER_MAIN`.

Example:

```txt
pnpm docker:build:api
pnpm docker:build:web
pnpm docker:build:ai-worker
pnpm docker:build:apps
```
