# Dev Terraform Environment

Low-cost development infrastructure: a single k3s EC2 node with PostgreSQL,
Redis and Kafka running in-cluster, plus the ECR repositories and Secrets
Manager container the dev overlay expects.

## What it creates

- **Network** (`agentops-dev`): a VPC (`10.20.0.0/16`) with two public
  (`10.20.0.0/24`, `10.20.1.0/24`) and two private (`10.20.10.0/24`,
  `10.20.11.0/24`) subnets. NAT is disabled in dev.
- **ECR** (`dev`): one repository per application image
  (`api`, `web`, `tools`, `workflow-worker`, `ai-worker`, `tool-worker`,
  `notification-worker`).
- **App secret** (`agentops/dev/app`): the Secrets Manager container only —
  secret values are populated outside Terraform so they never enter state.
- **k3s**: one EC2 node in the first public subnet with a static Elastic IP,
  an encrypted gp3 root volume, IMDSv2 enforced, and an instance profile with
  SSM and ECR read access. SSH is not opened; reach the host via SSM.
- **GitHub OIDC**: the CI role that GitHub Actions assumes to push images and
  manage Terraform state. It reuses the account's OIDC provider from the
  bootstrap stack (`github_oidc_provider_arn`) instead of creating a second one.

The dev CI role is trust-scoped to refs on branch `main` only; pull_request and
environment subject claims cannot assume it.

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
| `environment` | Environment name applied as the `env` tag. | `string` | `"dev"` |
| `owner` | Team or owner responsible for these resources. | `string` | n/a |
| `azs` | Availability zones to spread subnets across. | `list(string)` | `["ap-southeast-1a", "ap-southeast-1b"]` |
| `github_repository` | Repo allowed to assume the CI role. | `string` | n/a |
| `create_github_oidc_provider` | Create the GitHub OIDC provider. | `bool` | `false` |
| `github_oidc_provider_arn` | ARN from the bootstrap output `github_oidc_provider_arn`. | `string` | `""` |
| `terraform_state_bucket_arn` | State bucket ARN granted to the CI role. | `string` | `""` |
| `terraform_lock_table_arn` | Lock table ARN granted to the CI role. | `string` | `""` |
| `offline_plan` | Skip AWS checks for offline plan only. | `bool` | `false` |
| `ami_id` | Ubuntu 24.04 AMI id for the k3s host. | `string` | n/a |
| `instance_type` | EC2 instance type for the k3s node. | `string` | `"t3.large"` |
| `admin_cidr_blocks` | CIDRs allowed to reach the Kubernetes API (6443). | `list(string)` | n/a |

## Outputs

| Output | Feeds |
| --- | --- |
| `k3s_public_ip` | DNS target for the dev hosts (`dev.agentops.example.com`). |
| `k3s_instance_id` | SSM Session Manager access to the host. |
| `ecr_repository_urls` | `images[].newName` in `infrastructure/k8s/overlays/dev/kustomization.yaml` (replace the `000000000000.dkr.ecr...` placeholder account id). |
| `app_secret_name` | `ExternalSecret` key in the dev overlay (`agentops/dev/app`). |
| `ci_role_arn` | `AWS_ROLE_TO_ASSUME` in the GitHub Actions workflow. |
| `github_oidc_provider_arn` | The provider the CI role trusts (created or supplied). |

## Output to overlay mapping

```txt
terraform output -raw k3s_public_ip       -> DNS for dev.agentops.example.com
terraform output -json ecr_repository_urls -> images[].newName in the dev kustomization
terraform output -raw app_secret_name      -> ExternalSecret spec.dataFrom[0].extract.key
terraform output -raw ci_role_arn          -> the workflow's assume-role target
```

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars   # fill in owner, repo, ami_id, admin CIDRs
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```
