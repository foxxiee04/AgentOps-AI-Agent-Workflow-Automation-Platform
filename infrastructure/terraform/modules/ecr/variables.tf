variable "name" {
  description = "Environment prefix for the ECR repositories (e.g. \"dev\")."
  type        = string
}

variable "tags" {
  description = "Tags applied to all ECR resources."
  type        = map(string)
  default     = {}
}

variable "repositories" {
  description = "Application image repository names. Each becomes \"<name>/<app>\"."
  type        = list(string)
  default = [
    "api",
    "web",
    "tools",
    "workflow-worker",
    "ai-worker",
    "tool-worker",
    "notification-worker",
  ]
}

variable "image_retention_count" {
  description = "Number of tagged images to retain per repository."
  type        = number
  default     = 30
}

variable "force_delete" {
  description = "Allow destroying repositories that still contain images (only for short-lived environments)."
  type        = bool
  default     = false
}
