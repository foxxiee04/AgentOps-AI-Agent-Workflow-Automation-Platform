output "secret_arn" {
  description = "ARN of the application secret container."
  value       = aws_secretsmanager_secret.app.arn
}

output "secret_name" {
  description = "Name of the application secret container."
  value       = aws_secretsmanager_secret.app.name
}

output "secret_arn_prefix" {
  description = "Wildcard ARN prefix for secrets under this environment, used by the EKS IRSA policy."
  value       = "arn:aws:secretsmanager:*:*:secret:agentops/${var.name}/*"
}
