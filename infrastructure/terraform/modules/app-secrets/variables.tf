variable "name" {
  description = "Environment name for the secret (e.g. \"dev\")."
  type        = string
}

variable "tags" {
  description = "Tags applied to the secrets container."
  type        = map(string)
  default     = {}
}

variable "recovery_window_in_days" {
  description = "Number of days Secrets Manager retains a deleted secret before permanent removal."
  type        = number
  default     = 7
}
