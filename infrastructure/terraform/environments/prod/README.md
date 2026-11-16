# Prod Terraform Environment

Production infrastructure backed by managed AWS services: EKS for compute, RDS
PostgreSQL, ElastiCache for Redis and MSK for Kafka. The Kubernetes overlay in
`infrastructure/k8s/overlays/prod` expects these endpoints to be filled in.

## What it creates

- **Network** (`agentops-prod`): a VPC (`10.30.0.0/16`) with two public
  (`10.30.0.0/24`, `10.30.1.0/24`) and two private (`10.30.10.0/24`,
  `10.30.11.0/24`) subnets and a NAT gateway for private egress.
- **ECR** (`prod`): one repository per application image (`api`, `web`,
  `tools`, `workflow-worker`, `ai-worker`, `tool-worker`,
  `notification-worker`).
- **App secret** (`agentops/prod/app`): the Secrets Manager container only —
  secret values are populated outside Terraform so they never enter state.
- **EKS** (`agentops-prod`): a managed cluster and node group in the private
  subnets, an IRSA role for the `external-secrets` service account scoped to
  `agentops/prod/*`, and the public API endpoint restricted by
  `eks_public_access_cidrs`.
- **RDS** PostgreSQL, **ElastiCache** Redis and **MSK** Kafka, each in the
  private subnets and reachable only from the VPC CIDR.
- **GitHub OIDC**: the CI role that promotes images and runs `kubectl` against
  the EKS cluster, with access to the ECR repositories, the EKS cluster and the
  Terraform state. It reuses the account's OIDC provider from the bootstrap
  stack (`github_oidc_provider_arn`) instead of creating a second one.

The prod CI role is trust-scoped to the GitHub environment `production` only;
branch and pull_request subject claims cannot assume it.

No `aws_vpc`, `aws_subnets`, `aws_ami` or `aws_caller_identity` data sources are
used, so validation and planning never call AWS to look resources up.

## Backend

The stack uses partial S3 backend configuration. Copy `backend.hcl.example` to
`backend.hcl`, replace the bucket placeholder with the value from the bootstrap
stack, then run:

```bash
terraform init -backend-config=backend.hcl
```

## Offline plan

Set `offline_plan = true` to skip AWS credential, account, metadata and region
checks. This is only for validating plans without AWS credentials and must
never be used for `apply`.

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `aws_region` | AWS region for all resources. | `string` | `"ap-southeast-1"` |
| `environment` | Environment name applied as the `env` tag. | `string` | `"prod"` |
| `owner` | Team or owner responsible for these resources. | `string` | n/a |
| `azs` | Availability zones to spread subnets across. | `list(string)` | `["ap-southeast-1a", "ap-southeast-1b"]` |
| `github_repository` | Repo allowed to assume the CI role. | `string` | n/a |
| `create_github_oidc_provider` | Create the GitHub OIDC provider. | `bool` | `false` |
| `github_oidc_provider_arn` | ARN from the bootstrap output `github_oidc_provider_arn`. | `string` | `""` |
| `dev_ecr_repository_arns` | dev ECR repository ARNs the prod CI role may pull from during promotion. | `list(string)` | `[]` |
| `terraform_state_bucket_arn` | State bucket ARN granted to the CI role. | `string` | `""` |
| `terraform_lock_table_arn` | Lock table ARN granted to the CI role. | `string` | `""` |
| `offline_plan` | Skip AWS checks for offline plan only. | `bool` | `false` |
| `eks_public_access_cidrs` | CIDRs allowed to reach the public EKS API endpoint. | `list(string)` | `["0.0.0.0/0"]` |
| `rds_multi_az` | Deploy a Multi-AZ RDS standby. | `bool` | `false` |
| `rds_instance_class` | RDS instance class. | `string` | `"db.t4g.micro"` |
| `redis_node_type` | ElastiCache node type for Redis. | `string` | `"cache.t4g.micro"` |
| `msk_broker_instance_type` | MSK broker instance type. | `string` | `"kafka.t3.small"` |
| `ephemeral` | Short-lived environment: no RDS deletion protection or final snapshot, immediate secret deletion, ECR force delete, so `terraform destroy` leaves nothing behind. | `bool` | `false` |

## Outputs

| Output | Feeds |
| --- | --- |
| `eks_cluster_name` | `aws eks update-kubeconfig --name ...` and the deploy workflow. |
| `eks_cluster_endpoint` | CI/kubeconfig cluster endpoint. |
| `external_secrets_role_arn` | The `serviceAccountRef` IRSA role in `infrastructure/k8s/overlays/prod/cluster-secret-store.yaml`. |
| `rds_endpoint` | Host used to build `DATABASE_URL` in the `agentops/prod/app` secret. |
| `rds_master_user_secret_arn` | Source of the RDS password in `DATABASE_URL`. |
| `redis_url` | `REDIS_URL` in `infrastructure/k8s/overlays/prod/kustomization.yaml` (replace `REPLACE_WITH_ELASTICACHE_ENDPOINT`). |
| `kafka_bootstrap_brokers` | `KAFKA_BROKERS` in the prod kustomization (replace `REPLACE_WITH_MSK_BOOTSTRAP_BROKERS`). |
| `ecr_repository_urls` | `images[].newName` in the prod kustomization (replace the placeholder account id). |
| `app_secret_name` | `ExternalSecret` key in the prod overlay (`agentops/prod/app`). |
| `ci_role_arn` | `AWS_ROLE_TO_ASSUME` in the GitHub Actions workflow. |

## Output to overlay mapping

```txt
terraform output -json ecr_repository_urls       -> images[].newName in the prod kustomization
terraform output -raw kafka_bootstrap_brokers     -> KAFKA_BROKERS (append :9092)
terraform output -raw redis_url                   -> REDIS_URL
terraform output -raw app_secret_name             -> ExternalSecret spec.dataFrom[0].extract.key
terraform output -raw external_secrets_role_arn   -> ClusterSecretStore IRSA role
terraform output -raw rds_endpoint                -> DATABASE_URL host in the secret
terraform output -raw rds_master_user_secret_arn  -> DATABASE_URL password lookup
terraform output -raw eks_cluster_name            -> update-kubeconfig in the deploy workflow
terraform output -raw ci_role_arn                 -> the workflow's assume-role target
```

> Note: the prod kustomization sets `REDIS_URL` with a `redis://` prefix while
> `redis_url` is emitted with `rediss://` (TLS). Use the output value as-is so
> the client negotiates TLS.

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars   # fill in owner and repo
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```
