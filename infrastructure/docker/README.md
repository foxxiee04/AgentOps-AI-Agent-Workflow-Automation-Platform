# Docker

This folder will hold app Dockerfiles and containerization notes once source apps exist.

## Planned Images

- `agentops/web:local`
- `agentops/api:local`
- `agentops/workflow-worker:local`
- `agentops/ai-worker:local`
- `agentops/tool-worker:local`
- `agentops/notification-worker:local`

Local dependencies are already represented in the root `docker-compose.yml`.

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
