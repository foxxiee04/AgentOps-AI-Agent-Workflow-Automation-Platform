variable "name" {
  description = "Name prefix for the k3s host resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC id the k3s host runs in."
  type        = string
}

variable "subnet_id" {
  description = "Public subnet id for the k3s host."
  type        = string
}

variable "ami_id" {
  description = "Ubuntu 24.04 AMI id for the k3s host (passed in; no AMI data source)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the k3s node."
  type        = string
  default     = "t3.large"
}

variable "root_volume_gb" {
  description = "Size of the encrypted gp3 root volume in GiB."
  type        = number
  default     = 50
}

variable "ingress_cidr_blocks" {
  description = "CIDR blocks allowed to reach HTTP (80) and HTTPS (443)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks allowed to reach the Kubernetes API (6443). SSH is not opened; use SSM Session Manager."
  type        = list(string)
}
