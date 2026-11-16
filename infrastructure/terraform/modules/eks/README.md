# EKS Module

Production Kubernetes cluster: a managed EKS control plane with a managed node
group and an IRSA role that lets External Secrets read from Secrets Manager.

- Cluster IAM role with `AmazonEKSClusterPolicy`; control plane logging for
  `api`, `audit`, and `authenticator`.
- Endpoint access is configurable (`endpoint_public_access`,
  `public_access_cidrs`); authentication uses `API_AND_CONFIG_MAP` so both IAM
  access entries and the `aws-auth` ConfigMap work.
- Node IAM role with `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, and
  `AmazonEC2ContainerRegistryReadOnly`; node group uses
  `AL2023_x86_64_STANDARD` with `update_config.max_unavailable = 1`.
- An IAM OIDC provider is created from the cluster issuer, and the
  `external-secrets` IRSA role trusts the
  `system:serviceaccount:external-secrets:external-secrets` subject and is
  scoped to `secretsmanager:GetSecretValue` / `DescribeSecret` on
  `secrets_arn_prefix` (a wildcard is appended).

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `name` | Name prefix for the cluster and supporting resources. | `string` | n/a |
| `tags` | Tags applied to all taggable resources. | `map(string)` | `{}` |
| `kubernetes_version` | Kubernetes control plane version. | `string` | `"1.31"` |
| `vpc_id` | VPC id the cluster runs in. | `string` | n/a |
| `private_subnet_ids` | Private subnets for the control plane and node group. | `list(string)` | n/a |
| `endpoint_public_access` | Whether the API endpoint is public. | `bool` | `true` |
| `public_access_cidrs` | CIDRs allowed to reach the public API endpoint. | `list(string)` | `["0.0.0.0/0"]` |
| `node_instance_types` | Node group instance types. | `list(string)` | `["t3.medium"]` |
| `node_min` | Minimum nodes. | `number` | `2` |
| `node_max` | Maximum nodes. | `number` | `4` |
| `node_desired` | Desired nodes. | `number` | `2` |
| `secrets_arn_prefix` | Secrets Manager ARN prefix External Secrets may read (no trailing wildcard; one is appended). | `string` | n/a |

## Outputs

| Name | Description |
| --- | --- |
| `cluster_name` | Name of the EKS cluster. |
| `cluster_endpoint` | Endpoint of the Kubernetes API. |
| `cluster_arn` | ARN of the EKS cluster. |
| `cluster_security_group_id` | Cluster-managed security group id. |
| `oidc_provider_arn` | ARN of the IAM OIDC provider for IRSA. |
| `external_secrets_role_arn` | IRSA role ARN for the external-secrets service account. |
