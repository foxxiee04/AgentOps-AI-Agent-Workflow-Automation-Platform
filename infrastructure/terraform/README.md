# Terraform

Infrastructure is split into reusable modules and per-environment entrypoints.

## Layout

```txt
terraform/
  modules/
    network/        # VPC, subnets, IGW, optional NAT
    k3s/            # single-node k3s EC2 host (dev)
    eks/            # managed control plane + node group + IRSA (prod)
    rds/            # PostgreSQL RDS instance
    elasticache/    # Redis replication group
    msk/            # Amazon MSK (Kafka) cluster
    ecr/            # application/worker image repositories
    app-secrets/    # Secrets Manager container (agentops/<env>/app)
    github-oidc/    # GitHub Actions OIDC CI role
    storage/        # storage primitives (placeholder)
  environments/
    bootstrap/      # S3 state bucket + DynamoDB lock table (once per account)
    dev/            # k3s on EC2 with in-cluster data services
    prod/           # EKS + RDS + ElastiCache + MSK
```

## Tagging policy

Each environment's AWS provider sets `default_tags`: `project = "agentops"`, `env`, `owner`, and `managed-by = "terraform"`. Modules also accept a `tags` map so resources outside `default_tags` (for example S3 buckets) can be tagged consistently.

## Remote state

- `bootstrap` runs **once per account** and keeps local state, because it is the stack that creates the remote-state bucket. It creates a versioned, AES256-encrypted S3 state bucket (public access blocked, TLS-only policy) and a DynamoDB lock table (`LockID`, PAY_PER_REQUEST, encrypted, PITR).
- `dev` and `prod` use a partial S3 backend. Copy `backend.hcl.example` to `backend.hcl`, fill in the bucket from the bootstrap outputs, then run `terraform init -backend-config=backend.hcl` per environment. State is versioned, encrypted, and locked through the DynamoDB table.

## Validation

`pnpm tf:validate` (which runs `node infrastructure/terraform/validate.mjs`) checks everything without touching AWS:

1. `terraform fmt -check -recursive`.
2. Per environment: `init` with a local backend override, `validate`, then an **offline plan** checked against the resource allowlist in `allowed-resources.json`.
3. `tflint` (via Docker, no host install) for all three environments.

The offline plan uses `offline_plan = true` and fake credentials so no AWS calls are made; it is validation only and must never be used for `apply`.

## Apply policy

- Plans run in pull requests.
- Apply runs only through the approved CI workflow (GitHub OIDC, no static AWS keys).
- No plan in this repo was run against a real AWS account; validation is **offline plan only**.

## Outputs to Kubernetes overlay mapping

| Terraform output | Kubernetes overlay |
| --- | --- |
| `kafka_bootstrap_brokers` | `KAFKA_BROKERS` |
| `redis_url` | `REDIS_URL` |
| `rds_endpoint` + the RDS-managed secret | `DATABASE_URL`, built into `agentops/prod/app` |
| `external_secrets_role_arn` | the External Secrets service account (IRSA) |
| `ecr_repository_urls` | the overlay `images:` newName values |

Secret values for `agentops/<env>/app` are set outside Terraform and synced into the cluster by External Secrets (so they never appear in state or plans).
