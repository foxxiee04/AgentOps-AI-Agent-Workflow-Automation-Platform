# AWS Overlay

Use this overlay for AWS-backed Kubernetes deployments.

Recommended paths:

- EC2 + k3s for a low-cost portfolio demo.
- EKS for a managed Kubernetes deployment when budget allows.

Before deploying:

- Replace placeholder secrets in `base/secrets.example.yaml`.
- Patch images to ECR repository URLs from Terraform output `ecr_repository_urls`.
- Set public hostnames for `agentops` and `api.agentops`.
- Run `pnpm db:push` as a one-time migration/sync step after PostgreSQL is reachable.
- Run `pnpm kafka:bootstrap` after Kafka is reachable.

Example:

```bash
kubectl apply -f ../../base/namespace.yaml
kubectl apply -f ../../base/secrets.example.yaml
kubectl apply -f ../../base/configmap.yaml
kubectl apply -f ../../base/data.yaml
kubectl apply -f ../../base/apps.yaml
kubectl apply -f ../../base/ingress.yaml
```

For production, use External Secrets, AWS Secrets Manager, or sealed secrets instead of applying placeholder secrets.
