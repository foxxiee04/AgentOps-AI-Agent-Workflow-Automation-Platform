variable "name" {
  description = "Name prefix for network resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to all network resources."
  type        = map(string)
  default     = {}
}

variable "cidr_block" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "azs" {
  description = "Availability zones to spread subnets across."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the public subnets, one per availability zone."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) == length(var.azs)
    error_message = "public_subnet_cidrs must contain exactly one CIDR per availability zone in azs."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the private subnets, one per availability zone."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_cidrs) == length(var.azs)
    error_message = "private_subnet_cidrs must contain exactly one CIDR per availability zone in azs."
  }
}

variable "enable_nat" {
  description = "Whether to create a NAT gateway for private subnet egress."
  type        = bool
  default     = false
}
