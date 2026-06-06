variable "name" {
  description = "Name prefix for security resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC id for the security group."
  type        = string
}

variable "ssh_cidr" {
  description = "CIDR allowed to access SSH."
  type        = string
}

