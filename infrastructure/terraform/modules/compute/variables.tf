variable "name" {
  description = "Name prefix for compute resources."
  type        = string
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

variable "subnet_id" {
  description = "Subnet id for the k3s host."
  type        = string
}

variable "security_group_ids" {
  description = "Security groups for the k3s host."
  type        = list(string)
}

variable "key_name" {
  description = "Existing EC2 key pair name."
  type        = string
}

