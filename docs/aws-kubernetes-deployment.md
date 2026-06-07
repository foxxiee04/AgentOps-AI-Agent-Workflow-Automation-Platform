# AWS Kubernetes Deployment

AgentOps should support two AWS deployment tracks.

## Track A: EC2 + k3s

Best for the portfolio/demo phase.

```txt
Terraform
-> default VPC security group
-> EC2 instance
-> k3s bootstrap
-> ECR repositories
-> kubectl apply Kubernetes manifests
```

Why this track:

- Lower cost than managed Kubernetes.
- Still demonstrates Kubernetes, Terraform, container images, health checks, and smoke tests.
- Easier to stop/destroy after demos.

## Track B: EKS

Best when the project needs a managed Kubernetes story.

```txt
Terraform or eksctl
-> EKS cluster
-> managed node group or EKS Auto Mode
-> ECR repositories
-> ingress/load balancer
-> Kubernetes manifests or Helm chart
```

Why this track:

- Managed Kubernetes control plane.
- Stronger production-style AWS story.
- Easier to extend with IRSA, AWS Load Balancer Controller, managed autoscaling, and managed data services.

## Image Registry

Use AWS ECR repositories for:

```txt
api
web
workflow-worker
ai-worker
tool-worker
notification-worker
```

Terraform dev environment now outputs `ecr_repository_urls`. CI/CD should build each Docker image, push to ECR, patch Kubernetes image names, then deploy.

## Runtime Services

The current Kubernetes base includes demo-grade in-cluster:

- PostgreSQL
- Redis
- Kafka

For a more production-like AWS deployment, replace them with:

- RDS PostgreSQL
- ElastiCache Redis
- MSK or a smaller managed Kafka-compatible service

Keep the environment variables stable:

```txt
DATABASE_URL
REDIS_URL
KAFKA_BROKERS
OPENAI_API_KEY
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
```

## Deploy Order

```txt
1. terraform init/plan/apply
2. build and push images to ECR
3. create or replace Kubernetes secrets
4. apply namespace, config, data services, apps, ingress
5. run pnpm db:push against the deployment database
6. run pnpm kafka:bootstrap against the deployment Kafka broker
7. smoke test /health/live and /health/ready
```

## Cost Guardrails

- Prefer EC2 + k3s until the app is demo-ready.
- Destroy EKS test clusters after use.
- Keep worker replicas at 1 for demo.
- Use small PVCs and short ECR lifecycle policies.
- Move to managed RDS/MSK only when the deployment story needs it.
