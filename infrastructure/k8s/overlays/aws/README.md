# AWS Overlay

This folder is a pointer for AWS-backed deployments. The deployed manifests live in `overlays/prod`; use it as the base and satisfy the prerequisites below.

Before deploying:

- Install ingress-nginx, cert-manager, and External Secrets.
- Create the secret key `agentops/prod/app` in AWS Secrets Manager.
- Patch images to the ECR repository URLs from Terraform output `ecr_repository_urls` (pinned per release).
- Set the managed MSK/ElastiCache endpoints from Terraform outputs, and set public hostnames for `agentops` and `api.agentops`.
- Apply the migration Job once per release, then the overlay:

```bash
kubectl apply -k ../../jobs/db-migrate
kubectl apply -k ../prod
```

Deploy with `kubectl apply -k` (kustomize) only. There is no per-file `kubectl apply -f` and no `db:push` step.
