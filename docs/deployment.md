# Deployment

Deployment is planned in layers: local infrastructure, containers, Kubernetes, Terraform, then CI/CD automation.

## Local

- Use `docker-compose.yml` for PostgreSQL, Redis, and Kafka.
- Add app Dockerfiles after the web/API/worker code exists.
- Keep local ports stable: web `3000`, API `4000`, PostgreSQL host `55432`, Kafka external `9094`.

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
