output "state_bucket_name" {
  description = "Name of the S3 bucket holding Terraform remote state."
  value       = aws_s3_bucket.state.id
}

output "state_bucket_arn" {
  description = "ARN of the Terraform remote state bucket."
  value       = aws_s3_bucket.state.arn
}

output "lock_table_name" {
  description = "Name of the DynamoDB table used for state locking."
  value       = aws_dynamodb_table.locks.name
}

output "lock_table_arn" {
  description = "ARN of the DynamoDB state lock table."
  value       = aws_dynamodb_table.locks.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the account's GitHub Actions OIDC provider, passed to the dev and prod stacks."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "terraform_plan_role_arn" {
  description = "ARN of the read-only role assumed by terraform-plan.yml (AWS_TF_PLAN_ROLE_ARN_DEV/PROD)."
  value       = aws_iam_role.terraform_plan.arn
}

output "terraform_apply_role_arns" {
  description = "Map of environment to the apply role ARN assumed by terraform-apply.yml (AWS_TF_APPLY_ROLE_ARN_DEV/PROD)."
  value       = { for env, role in aws_iam_role.terraform_apply : env => role.arn }
}
