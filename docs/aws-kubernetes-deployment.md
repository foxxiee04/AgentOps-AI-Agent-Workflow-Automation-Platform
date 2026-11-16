# AWS Kubernetes Deployment

AgentOps should support two AWS deployment tracks.

## Terraform

Two environment entrypoints drive everything (see `infrastructure/terraform/README.md`):

- `environments/dev`: k3s on one EC2 node — the dev/demo track.
- `environments/prod`: EKS + managed data services — the production track.

Both apply through the approved CI workflow (GitHub OIDC, no static AWS keys) after a plan in the PR. The high-level flow:

```txt
bootstrap (once per account: S3 state bucket + DynamoDB lock table)
-> dev (k3s) or prod (EKS) apply via CI
-> install ingress-nginx, cert-manager, External Secrets
-> fill the app secret (agentops/<env>/app)
-> run the db-migrate Job
-> kubectl apply -k the overlay
```

## Track A: EC2 + k3s

Best for the portfolio/demo phase.

```txt
Terraform (environments/dev)
-> VPC + security group
-> EC2 instance
-> k3s bootstrap
-> ECR repositories
-> kubectl apply -k the dev overlay
```

Why this track:

- Lower cost than managed Kubernetes.
- Still demonstrates Kubernetes, Terraform, container images, health checks, and smoke tests.
- Easier to stop/destroy after demos.

## Track B: EKS

Best when the project needs a managed Kubernetes story.

```txt
Terraform (environments/prod)
-> EKS cluster
-> managed node group
-> ECR repositories
-> ingress/load balancer
-> kubectl apply -k the prod overlay
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

The Terraform environments output `ecr_repository_urls`. CI/CD should build each Docker image, push to ECR, set the overlay `images:` newName values, then deploy by applying the overlay.

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
1. bootstrap the Terraform state backend (once per account)
2. apply dev (k3s) or prod (EKS) through CI
3. install ingress-nginx, cert-manager, and External Secrets
4. fill the app secret (agentops/<env>/app)
5. run the db-migrate Job (never `db:reset`, which refuses non-local hosts)
6. kubectl apply -k infrastructure/k8s/overlays/<env>
7. smoke test /health/live and /health/ready
```

Kafka bootstrap is handled by the in-cluster Kafka (dev) or MSK (prod); there is no separate `kafka:bootstrap` step.

## Cost Guardrails

- Prefer EC2 + k3s until the app is demo-ready.
- Destroy EKS test clusters after use.
- Keep worker replicas at 1 for demo.
- Use small PVCs and short ECR lifecycle policies.
- Move to managed RDS/MSK only when the deployment story needs it.
