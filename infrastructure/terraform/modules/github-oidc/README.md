# GitHub OIDC Module

Creates a GitHub Actions CI role that assumes AWS access through OpenID Connect
instead of static access keys.

The module can create the GitHub OIDC provider (`create_oidc_provider = true`,
default) or reuse one that already exists in the account by passing
`oidc_provider_arn`.

The role trust policy only allows the configured repository, restricted to the
listed branches, environments, and (optionally) pull requests. Its inline policy
grants ECR push/pull for the supplied repositories, plus optional permissions for
`eks:DescribeCluster`, Terraform state in S3, and Terraform state locking in
DynamoDB.

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `name` | Name prefix for the CI role. | `string` | n/a |
| `tags` | Tags applied to all taggable resources. | `map(string)` | `{}` |
| `github_repository` | Repository allowed to assume the role (`owner/repo`). | `string` | n/a |
| `allowed_branches` | Branches allowed via ref subject claims. | `list(string)` | `["main"]` |
| `allow_pull_requests` | Allow `pull_request` subject claims. | `bool` | `true` |
| `allowed_environments` | GitHub environments allowed to assume the role. | `list(string)` | `["dev", "production"]` |
| `create_oidc_provider` | Create the GitHub OIDC provider. | `bool` | `true` |
| `oidc_provider_arn` | Existing provider ARN when not creating one. | `string` | `""` |
| `ecr_repository_arns` | ECR repositories the role may push/pull. | `list(string)` | n/a |
| `eks_cluster_arn` | EKS cluster the role may describe. | `string` | `""` |
| `terraform_state_bucket_arn` | S3 bucket holding Terraform state. | `string` | `""` |
| `terraform_lock_table_arn` | DynamoDB table used for state locking. | `string` | `""` |

## Outputs

| Name | Description |
| --- | --- |
| `ci_role_arn` | ARN of the GitHub Actions CI role. |
| `oidc_provider_arn` | ARN of the GitHub OIDC provider. |
