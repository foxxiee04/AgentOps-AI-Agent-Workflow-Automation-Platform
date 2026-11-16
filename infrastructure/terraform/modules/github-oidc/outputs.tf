output "ci_role_arn" {
  description = "ARN of the GitHub Actions CI role."
  value       = aws_iam_role.this.arn
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider (created or supplied)."
  value       = local.oidc_provider_arn
}
