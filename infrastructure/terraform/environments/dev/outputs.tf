output "k3s_public_ip" {
  description = "Elastic IP of the k3s host; point DNS at this address."
  value       = module.k3s.public_ip
}

output "k3s_instance_id" {
  description = "Instance id of the k3s host, for SSM Session Manager access."
  value       = module.k3s.instance_id
}

output "ecr_repository_urls" {
  description = "Map of application name to ECR repository URL."
  value       = module.ecr.repository_urls
}

output "app_secret_name" {
  description = "Name of the application secret container in Secrets Manager."
  value       = module.app_secrets.secret_name
}

output "ci_role_arn" {
  description = "ARN of the GitHub Actions CI role."
  value       = module.github_oidc.ci_role_arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider (created or supplied)."
  value       = module.github_oidc.oidc_provider_arn
}
