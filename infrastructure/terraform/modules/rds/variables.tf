variable "name" {
  description = "Name prefix for RDS resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable RDS resources."
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC id where the database and security group are created."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet ids used for the database subnet group."
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the database port."
  type        = list(string)
}

variable "engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GiB."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum storage for autoscaling in GiB."
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Whether to deploy a Multi-AZ standby."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Whether to protect the instance from deletion."
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7
}

variable "db_name" {
  description = "Name of the initial database."
  type        = string
  default     = "agentops"
}

variable "username" {
  description = "Master username for the database."
  type        = string
  default     = "agentops"
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on destroy (only for short-lived environments)."
  type        = bool
  default     = false
}
