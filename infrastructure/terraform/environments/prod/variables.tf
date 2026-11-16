variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name applied as the `env` tag."
  type        = string
  default     = "prod"
}

variable "owner" {
  description = "Team or owner responsible for these resources."
  type        = string
}

variable "azs" {
  description = "Availability zones to spread subnets across."
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "github_repository" {
  description = "GitHub repository allowed to assume the CI role, in \"owner/repo\" form."
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Whether to create the GitHub OIDC provider in this account."
  type        = bool
  default     = false
}

variable "github_oidc_provider_arn" {
  description = "ARN from the bootstrap output github_oidc_provider_arn"
  type        = string
  default     = ""

  validation {
    condition     = var.create_github_oidc_provider || length(var.github_oidc_provider_arn) > 0
    error_message = "github_oidc_provider_arn must be set to the bootstrap output github_oidc_provider_arn when create_github_oidc_provider is false."
  }
}

variable "dev_ecr_repository_arns" {
  description = "dev ECR repository ARNs the prod CI role may pull from during promotion"
  type        = list(string)
  default     = []
}

variable "terraform_state_bucket_arn" {
  description = "S3 bucket ARN holding Terraform state, granted to the CI role."
  type        = string
  default     = ""
}

variable "terraform_lock_table_arn" {
  description = "DynamoDB table ARN used for Terraform state locking, granted to the CI role."
  type        = string
  default     = ""
}

variable "offline_plan" {
  description = "Skip AWS credential, account, metadata and region checks so plan can run without credentials. Only for validating plans offline, never for apply."
  type        = bool
  default     = false
}

variable "eks_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public EKS Kubernetes API endpoint."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "rds_multi_az" {
  description = "Whether to deploy a Multi-AZ RDS standby."
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "redis_node_type" {
  description = "ElastiCache node type for Redis."
  type        = string
  default     = "cache.t4g.micro"
}

variable "msk_broker_instance_type" {
  description = "MSK broker instance type."
  type        = string
  default     = "kafka.t3.small"
}

variable "ephemeral" {
  description = "Short-lived environment: allow a clean `terraform destroy` (no RDS deletion protection or final snapshot, immediate secret deletion, ECR force delete)."
  type        = bool
  default     = false
}
