variable "name" {
  description = "Name prefix for MSK resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable MSK resources."
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC id where the cluster and security group are created."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet ids used as the broker client subnets."
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the broker ports."
  type        = list(string)
}

variable "kafka_version" {
  description = "Kafka version."
  type        = string
  default     = "3.9.x"
}

variable "broker_instance_type" {
  description = "Broker instance type."
  type        = string
  default     = "kafka.t3.small"
}

variable "broker_volume_gb" {
  description = "EBS volume size per broker in GiB."
  type        = number
  default     = 20
}
