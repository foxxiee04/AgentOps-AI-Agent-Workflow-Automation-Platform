output "eks_cluster_name" {
  description = "Name of the EKS cluster."
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint of the EKS cluster Kubernetes API."
  value       = module.eks.cluster_endpoint
}

output "external_secrets_role_arn" {
  description = "ARN of the IRSA role for the external-secrets service account."
  value       = module.eks.external_secrets_role_arn
}

output "rds_endpoint" {
  description = "Connection endpoint of the RDS database instance."
  value       = module.rds.endpoint
}

output "rds_master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the RDS master password."
  value       = module.rds.master_user_secret_arn
}

output "redis_url" {
  description = "TLS Redis connection URL."
  value       = module.elasticache.redis_url
}

output "kafka_bootstrap_brokers" {
  description = "Plaintext bootstrap broker connection string for MSK."
  value       = module.msk.bootstrap_brokers
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
