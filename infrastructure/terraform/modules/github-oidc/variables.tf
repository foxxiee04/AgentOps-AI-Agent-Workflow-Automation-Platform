variable "name" {
  description = "Name prefix for the CI role (e.g. \"dev\")."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}

variable "github_repository" {
  description = "GitHub repository allowed to assume the role, in \"owner/repo\" form."
  type        = string
}

variable "allowed_branches" {
  description = "Branches allowed to assume the role via ref-based subject claims."
  type        = list(string)
  default     = ["main"]
}

variable "allow_pull_requests" {
  description = "Whether pull_request subject claims may assume the role."
  type        = bool
  default     = true
}

variable "allowed_environments" {
  description = "GitHub environments allowed to assume the role."
  type        = list(string)
  default     = ["dev", "production"]
}

variable "create_oidc_provider" {
  description = "Whether to create the GitHub OIDC provider in this account."
  type        = bool
  default     = true
}

variable "oidc_provider_arn" {
  description = "Existing OIDC provider ARN, used when create_oidc_provider is false."
  type        = string
  default     = ""
}

variable "ecr_repository_arns" {
  description = "ECR repository ARNs the CI role may push to and pull from."
  type        = list(string)
}

variable "eks_cluster_arn" {
  description = "EKS cluster ARN the CI role may describe, when set."
  type        = string
  default     = ""
}

variable "terraform_state_bucket_arn" {
  description = "S3 bucket ARN holding Terraform state, when set."
  type        = string
  default     = ""
}

variable "terraform_lock_table_arn" {
  description = "DynamoDB table ARN used for Terraform state locking, when set."
  type        = string
  default     = ""
}
