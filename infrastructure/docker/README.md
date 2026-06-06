# Docker

This folder will hold app Dockerfiles and containerization notes once source apps exist.

## Planned Images

- `agentops-web`
- `agentops-api`
- `agentops-workflow-worker`
- `agentops-ai-worker`
- `agentops-tool-worker`
- `agentops-notification-worker`

Local dependencies are already represented in the root `docker-compose.yml`.

## Dockerfiles

- `web.Dockerfile`: builds and runs `@agentops/web`.
- `api.Dockerfile`: builds and runs `@agentops/api`.
- `worker.Dockerfile`: generic worker image; pass `WORKER_PACKAGE` and `WORKER_MAIN`.

Example:

```txt
docker build -f infrastructure/docker/api.Dockerfile -t agentops-api .
docker build -f infrastructure/docker/web.Dockerfile -t agentops-web .
docker build -f infrastructure/docker/worker.Dockerfile --build-arg WORKER_PACKAGE=@agentops/ai-worker --build-arg WORKER_MAIN=apps/ai-worker/dist/main.js -t agentops-ai-worker .
```
