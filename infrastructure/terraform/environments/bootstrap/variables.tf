variable "aws_region" {
  description = "AWS region for the remote state bucket and lock table."
  type        = string
  default     = "ap-southeast-1"
}

variable "owner" {
  description = "Team or owner responsible for these shared resources."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository allowed to assume the Terraform CI roles, in owner/repo form."
  type        = string
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform remote state."
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking."
  type        = string
  default     = "agentops-terraform-locks"
}

variable "offline_plan" {
  description = "Skip AWS credential, account, metadata and region checks so plan can run without credentials. Only for validating plans offline, never for apply."
  type        = bool
  default     = false
}
