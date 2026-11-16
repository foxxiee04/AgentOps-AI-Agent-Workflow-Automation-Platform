variable "name" {
  description = "Name prefix for ElastiCache resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable ElastiCache resources."
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC id where the cache and security group are created."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet ids used for the cache subnet group."
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to reach the Redis port."
  type        = list(string)
}

variable "engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters in the replication group."
  type        = number
  default     = 1
}
