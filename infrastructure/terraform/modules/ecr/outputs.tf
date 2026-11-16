output "repository_urls" {
  description = "Map of application name to ECR repository URL."
  value = {
    for app, repository in aws_ecr_repository.repositories : app => repository.repository_url
  }
}

output "repository_arns" {
  description = "Map of application name to ECR repository ARN."
  value = {
    for app, repository in aws_ecr_repository.repositories : app => repository.arn
  }
}
