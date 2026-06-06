---
name: agentops-devops
description: Guide AgentOps DevOps work. Use when creating or reviewing Docker, Docker Compose, Kubernetes manifests, Terraform modules/environments, GitHub Actions workflows, deployment docs, health checks, metrics, logs, or observability setup.
---

# AgentOps DevOps

## Workflow

1. Read `CODEX.md`.
2. Read `docs/deployment.md`.
3. Read `infrastructure/README.md`.
4. Inspect existing infrastructure files before adding resources.
5. Prefer local reliability before production complexity.

## Local Infrastructure

- Use root `docker-compose.yml` for PostgreSQL, Redis, and Kafka.
- Add app Dockerfiles after app source exists.
- Keep local ports documented and stable.

## Kubernetes Rules

- Add Deployment, Service, ConfigMap, Secret, Ingress, PVC, and HPA resources as needed.
- Include liveness and readiness probes.
- Keep common manifests in `infrastructure/k8s/base`.
- Keep environment-specific values in overlays.

## Terraform Rules

- Prefer the low-cost EC2 + k3s path for personal demo infrastructure.
- Keep modules under `infrastructure/terraform/modules`.
- Keep environment entrypoints under `infrastructure/terraform/environments`.
- Do not commit secrets or generated state files.

## CI/CD Rules

- Pull requests should lint, typecheck, test, and build.
- Main branch should build images and deploy only after appropriate approval.
- Avoid workflows that fail before source app packages exist.

