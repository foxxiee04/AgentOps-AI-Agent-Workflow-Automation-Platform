variable "name" {
  description = "Name prefix for ECR repositories."
  type        = string
}

variable "repository_names" {
  description = "Application image repository names."
  type        = list(string)
}
