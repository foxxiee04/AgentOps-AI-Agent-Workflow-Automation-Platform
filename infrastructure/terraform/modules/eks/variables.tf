variable "name" {
  description = "Name prefix for the EKS cluster and supporting resources."
  type        = string
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}

variable "kubernetes_version" {
  description = "Kubernetes control plane version."
  type        = string
  default     = "1.31"
}

variable "vpc_id" {
  description = "VPC id the cluster runs in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet ids used by the cluster control plane and node group."
  type        = list(string)
}

variable "endpoint_public_access" {
  description = "Whether the Kubernetes API endpoint is publicly accessible."
  type        = bool
  default     = true
}

variable "public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public Kubernetes API endpoint."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_min" {
  # t3.medium fits 17 pods per node. Two nodes are full with the app, monitoring and add-ons (EBS CSI), which
  # leaves no room for the extra pods of a rolling update, so the default is three.
  description = "Minimum number of nodes in the managed node group."
  type        = number
  default     = 3
}

variable "node_max" {
  description = "Maximum number of nodes in the managed node group."
  type        = number
  default     = 4
}

variable "node_desired" {
  description = "Desired number of nodes in the managed node group."
  type        = number
  default     = 3
}

variable "secrets_arn_prefix" {
  description = "Secrets Manager ARN prefix (e.g. the ARN of agentops/prod/) the External Secrets IRSA role may read."
  type        = string
}

variable "enable_network_policy" {
  description = "Run the VPC CNI network policy agent so Kubernetes NetworkPolicies are enforced."
  type        = bool
  default     = true
}
