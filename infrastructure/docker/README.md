# Docker

This folder holds the app Dockerfiles and container build notes for the local AgentOps stack.

## Images

Each `*.Dockerfile` is a multi-stage build: `base` (node:22-alpine + corepack pnpm 11.5.2) -> `deps` (`pnpm install --frozen-lockfile` with a BuildKit cache mount) -> `builder` (`pnpm --filter <app>... build`, then `pnpm --filter <app> deploy --prod --legacy /out`) -> `runner`. The runner ships only the app's `dist/` and production `node_modules`; Prisma CLI/Studio/PGlite/typescript are pruned because `@prisma/client` lists them as peers. Images never copy the whole monorepo.

| Image | Dockerfile |
| --- | --- |
| `agentops/web:local` | `web.Dockerfile` |
| `agentops/api:local` | `api.Dockerfile` |
| `agentops/workflow-worker:local` | `worker.Dockerfile` |
| `agentops/ai-worker:local` | `worker.Dockerfile` |
| `agentops/tool-worker:local` | `worker.Dockerfile` |
| `agentops/notification-worker:local` | `worker.Dockerfile` |

Runners share:

- non-root user `node` (uid 1000)
- `tini` as PID 1, so signals reach Node and workers leave their Kafka group on SIGTERM
- HEALTHCHECK on `/health/live` (api `:4000`, workers `:9100` via `WORKER_METRICS_PORT`, web `:3000/en`)

The web image uses Next.js `output: "standalone"` and runs `node apps/web/server.js`. `api.Dockerfile --target tools` builds the full workspace with dev deps (Prisma CLI, `tsx`); it backs the compose `setup` service and the Kubernetes `agentops-db-migrate` Job (`pnpm db:migrate:deploy && pnpm db:seed && pnpm kafka:bootstrap`). Measured sizes: web 207 MB, api 426 MB, workflow-worker 378 MB, ai-worker ~388 MB, tools 2.2 GB (job only).

`pnpm deploy` must only run inside Docker: on the host it rewrites `node_modules` state to production.

### Checks

- `pnpm docker:lint` runs hadolint v2.12.0 with `.hadolint.yaml` (DL3018 ignored: alpine package pins break rebuilds).
- `pnpm docker:build:apps` builds api, tools, web, and the four workers.
- Smoke check: api + workflow-worker containers healthy against the compose Postgres/Kafka, uid 1000, `/app` not writable, tools image `db:migrate:status` up to date.

## Full Local Stack

```bash
pnpm local:docker
```

This starts PostgreSQL, Redis, Kafka, Prometheus, Alertmanager, Grafana, Tempo, the NestJS API, the Next.js web app, and all four workers. A setup container runs `db:migrate:deploy`, `db:seed`, `db:seed:demo`, and Kafka topic bootstrap before the app services depend on it.

To reset local Docker state and return to a clean seeded database:

```bash
pnpm compose:apps:reset
```

This runs `docker compose down -v` for the AgentOps compose project, so local AgentOps Postgres/Redis/Kafka/observability volumes are deleted.

| Service | Host port |
| --- | --- |
| Web | `3000` |
| API | `4000` |
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

`worker.Dockerfile` is generic; pass `WORKER_PACKAGE` and `WORKER_MAIN` to build a specific worker.

Example:

```txt
pnpm local:docker
pnpm compose:apps:reset
pnpm docker:lint
pnpm docker:build:api
pnpm docker:build:web
pnpm docker:build:ai-worker
pnpm docker:build:apps
```
