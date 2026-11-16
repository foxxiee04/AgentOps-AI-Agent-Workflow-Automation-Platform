# Terraform Modules

Reusable Terraform modules live here. Each module includes `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, and its own README. Keep modules small and composable.

| Module | Purpose | Key inputs | Key outputs |
| --- | --- | --- | --- |
| `network` | VPC with public/private subnets across AZs, an internet gateway, and an optional NAT gateway for private egress. | `name`, `cidr_block`, `azs`, `public_subnet_cidrs`, `private_subnet_cidrs`, `enable_nat` | `vpc_id`, `vpc_cidr_block`, `public_subnet_ids`, `private_subnet_ids`, `nat_gateway_id` |
| `k3s` | Single-node k3s cluster on one EC2 instance (dev/demo), with an Elastic IP, SSM access, and no SSH ingress. | `name`, `vpc_id`, `subnet_id`, `ami_id`, `instance_type`, `root_volume_gb`, `ingress_cidr_blocks`, `admin_cidr_blocks` | `instance_id`, `public_ip`, `security_group_id` |
| `eks` | Managed EKS control plane, managed node group, and an IRSA role that lets External Secrets read Secrets Manager. | `name`, `kubernetes_version`, `vpc_id`, `private_subnet_ids`, `endpoint_public_access`, `public_access_cidrs`, `node_instance_types`, `node_min`, `node_max`, `node_desired`, `secrets_arn_prefix` | `cluster_name`, `cluster_endpoint`, `cluster_arn`, `cluster_security_group_id`, `oidc_provider_arn`, `external_secrets_role_arn` |
| `rds` | PostgreSQL RDS instance on private subnets, with the master password managed by RDS in Secrets Manager. | `name`, `vpc_id`, `subnet_ids`, `allowed_cidr_blocks`, `engine_version`, `instance_class`, `allocated_storage`, `multi_az`, `db_name`, `username` | `endpoint`, `address`, `port`, `db_name`, `master_user_secret_arn` |
| `elasticache` | Redis replication group on private subnets with encryption in transit and at rest. | `name`, `vpc_id`, `subnet_ids`, `allowed_cidr_blocks`, `engine_version`, `node_type`, `num_cache_clusters` | `primary_endpoint`, `redis_url` |
| `msk` | Amazon MSK (Kafka) cluster across private subnets, with a tuned configuration and broker security group. | `name`, `vpc_id`, `subnet_ids`, `allowed_cidr_blocks`, `kafka_version`, `broker_instance_type`, `broker_volume_gb` | `bootstrap_brokers`, `bootstrap_brokers_tls`, `cluster_arn` |
| `ecr` | One ECR repository per deployable image, with immutable tags, scan-on-push, and lifecycle rules. | `name`, `repositories`, `image_retention_count` | `repository_urls`, `repository_arns` |
| `app-secrets` | Secrets Manager container `agentops/<env>/app` (container only; values are set outside Terraform). | `name`, `recovery_window_in_days` | `secret_arn`, `secret_name`, `secret_arn_prefix` |
| `github-oidc` | GitHub Actions CI role that assumes AWS through OIDC (no static keys), plus an optional OIDC provider. | `name`, `github_repository`, `allowed_branches`, `allow_pull_requests`, `allowed_environments`, `create_oidc_provider`, `oidc_provider_arn`, `ecr_repository_arns`, `eks_cluster_arn`, `terraform_state_bucket_arn`, `terraform_lock_table_arn` | `ci_role_arn`, `oidc_provider_arn` |
| `storage` | Placeholder for storage primitives (state/artifact buckets). | `bucket_name` | `bucket_name` |
