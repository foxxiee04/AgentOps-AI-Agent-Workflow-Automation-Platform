variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Name prefix."
  type        = string
  default     = "agentops-dev"
}

variable "ami_id" {
  description = "AMI id for the k3s host."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Existing EC2 key pair name."
  type        = string
}

variable "ssh_cidr" {
  description = "CIDR allowed to access SSH."
  type        = string
}

variable "repository_names" {
  description = "ECR repositories to create for AgentOps images."
  type        = list(string)
  default = [
    "api",
    "web",
    "workflow-worker",
    "ai-worker",
    "tool-worker",
    "notification-worker"
  ]
}
