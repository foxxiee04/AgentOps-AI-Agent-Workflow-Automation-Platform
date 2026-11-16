variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name applied as the `env` tag."
  type        = string
  default     = "dev"
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

variable "ami_id" {
  description = "Ubuntu 24.04 AMI id for the k3s host (passed in; no AMI data source)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the k3s node."
  type        = string
  default     = "t3.large"
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks allowed to reach the Kubernetes API (6443). SSH is not opened; use SSM Session Manager."
  type        = list(string)
}
