# Terraform Environments

Environment entrypoints live here. Each calls modules from `../modules` and defines environment-specific variables.

| Environment | Purpose | Key inputs | Key outputs |
| --- | --- | --- | --- |
| `bootstrap` | Runs once per AWS account: creates the S3 remote-state bucket (versioned, encrypted, TLS-only) and the DynamoDB state-lock table. Keeps local state. | `aws_region`, `owner`, `state_bucket_name`, `lock_table_name`, `offline_plan` | `state_bucket_name`, `state_bucket_arn`, `lock_table_name`, `lock_table_arn` |
| `dev` | Low-cost dev/demo: VPC (NAT disabled), ECR repositories, the app-secrets container, one k3s EC2 `t3.large` node, and the GitHub OIDC CI role. Data services run in-cluster. | `owner`, `github_repository`, `ami_id`, `admin_cidr_blocks`, `azs`, `instance_type`, `terraform_state_bucket_arn`, `terraform_lock_table_arn` | `k3s_public_ip`, `k3s_instance_id`, `ecr_repository_urls`, `app_secret_name`, `ci_role_arn`, `github_oidc_provider_arn` |
| `prod` | Production: VPC with NAT, ECR repositories, the app-secrets container, EKS + node group (IRSA), RDS PostgreSQL, ElastiCache Redis, MSK Kafka, and the GitHub OIDC CI role (which gets an EKS access entry for `kubectl` deploys). | `owner`, `github_repository`, `azs`, `eks_public_access_cidrs`, `rds_instance_class`, `rds_multi_az`, `redis_node_type`, `msk_broker_instance_type`, `terraform_state_bucket_arn`, `terraform_lock_table_arn` | `eks_cluster_name`, `eks_cluster_endpoint`, `external_secrets_role_arn`, `rds_endpoint`, `rds_master_user_secret_arn`, `redis_url`, `kafka_bootstrap_brokers`, `ecr_repository_urls`, `app_secret_name`, `ci_role_arn` |

Both `dev` and `prod` use the S3 backend configured with `terraform init -backend-config=backend.hcl`, and neither uses `aws_vpc`, `aws_subnets`, `aws_ami`, or `aws_caller_identity` data sources so plans never call AWS.
