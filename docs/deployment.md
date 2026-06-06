# Deployment

Deployment is planned in layers: local infrastructure, containers, Kubernetes, Terraform, then CI/CD automation.

## Local

- Use `docker-compose.yml` for PostgreSQL, Redis, and Kafka.
- Add app Dockerfiles after the web/API/worker code exists.
- Keep local ports stable: web `3000`, API `4000`, Kafka external `9094`.

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

The API should expose:

```txt
GET /health/live
GET /health/ready
```

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

