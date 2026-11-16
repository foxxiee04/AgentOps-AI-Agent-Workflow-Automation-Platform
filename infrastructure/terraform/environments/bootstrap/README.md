# Bootstrap Environment

Run this stack **once per AWS account** to create the shared resources that
every other Terraform stack depends on:

- an S3 bucket for Terraform remote state (versioned, AES256 encrypted, all
  public access blocked, `BucketOwnerEnforced`, and a bucket policy that denies
  any request not made over TLS),
- a DynamoDB table for state locking (`PAY_PER_REQUEST`, hash key `LockID`,
  server-side encryption and point-in-time recovery enabled),
- the account's single GitHub Actions OIDC provider
  (`https://token.actions.githubusercontent.com`),
- `agentops-terraform-plan`, a read-only role trusted on
  `repo:<github_repository>:pull_request` for CI plans, and
- `agentops-terraform-apply-dev` / `agentops-terraform-apply-prod`, roles trusted
  only on `repo:<github_repository>:environment:terraform-<env>` (the GitHub
  environments with required reviewers).

After apply, set these repository variables (Settings > Secrets and variables >
Actions > Variables) so the Terraform workflows can assume the roles:

| Repository variable | Value |
| --- | --- |
| `AWS_TF_PLAN_ROLE_ARN_DEV` | `terraform_plan_role_arn` output |
| `AWS_TF_PLAN_ROLE_ARN_PROD` | `terraform_plan_role_arn` output |
| `AWS_TF_APPLY_ROLE_ARN_DEV` | `terraform_apply_role_arns["dev"]` output |
| `AWS_TF_APPLY_ROLE_ARN_PROD` | `terraform_apply_role_arns["prod"]` output |

Pass the `github_oidc_provider_arn` output to the dev and prod stacks (as their
`github_oidc_provider_arn` input) so they reuse this single provider rather than
creating their own.

## Local state

This stack intentionally keeps **local state** because it is the stack that
creates the remote-state bucket. `versions.tf` has no backend block; run it
before configuring remote backends elsewhere. After apply, use the outputs to
configure the backend of the other environments.

## Offline plan

The provider can skip AWS credential, account, metadata and region checks via
`offline_plan = true`. This is only for validating plans without AWS
credentials and must never be used for `apply`.

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `aws_region` | AWS region for the state bucket and lock table. | `string` | `"ap-southeast-1"` |
| `owner` | Team or owner responsible for these shared resources. | `string` | n/a |
| `state_bucket_name` | Globally unique S3 bucket name for Terraform state. | `string` | n/a |
| `lock_table_name` | DynamoDB table name for state locking. | `string` | `"agentops-terraform-locks"` |
| `github_repository` | GitHub repository (`owner/repo`) allowed to assume the CI roles. | `string` | n/a |
| `offline_plan` | Skip AWS validation checks for offline plan only. | `bool` | `false` |

## Outputs

| Name | Description |
| --- | --- |
| `state_bucket_name` | Name of the Terraform remote state bucket. |
| `state_bucket_arn` | ARN of the Terraform remote state bucket. |
| `lock_table_name` | Name of the DynamoDB state lock table. |
| `lock_table_arn` | ARN of the DynamoDB state lock table. |
| `github_oidc_provider_arn` | ARN of the GitHub Actions OIDC provider. |
| `terraform_plan_role_arn` | ARN of the read-only plan role. |
| `terraform_apply_role_arns` | Map of environment to apply role ARN. |

Copy `terraform.tfvars.example` to `terraform.tfvars` and replace the
placeholder bucket name with a globally unique value.
