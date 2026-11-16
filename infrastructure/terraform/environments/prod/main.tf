# Prod runs on managed AWS services: EKS for compute, RDS PostgreSQL,
# ElastiCache for Redis and MSK for Kafka. All data services live in the private
# subnets and only accept traffic from within the VPC. No `aws_vpc`,
# `aws_subnets`, `aws_ami` or `aws_caller_identity` data sources are used.

module "network" {
  source = "../../modules/network"

  name                 = "agentops-prod"
  cidr_block           = "10.30.0.0/16"
  azs                  = var.azs
  public_subnet_cidrs  = ["10.30.0.0/24", "10.30.1.0/24"]
  private_subnet_cidrs = ["10.30.10.0/24", "10.30.11.0/24"]
  enable_nat           = true
}

module "ecr" {
  source = "../../modules/ecr"

  name         = "prod"
  force_delete = var.ephemeral
}

module "app_secrets" {
  source = "../../modules/app-secrets"

  name                    = "prod"
  recovery_window_in_days = var.ephemeral ? 0 : 7
}

module "eks" {
  source = "../../modules/eks"

  name                = "agentops-prod"
  vpc_id              = module.network.vpc_id
  private_subnet_ids  = module.network.private_subnet_ids
  public_access_cidrs = var.eks_public_access_cidrs
  secrets_arn_prefix  = module.app_secrets.secret_arn_prefix
}

module "rds" {
  source = "../../modules/rds"

  name                = "prod"
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.private_subnet_ids
  allowed_cidr_blocks = [module.network.vpc_cidr_block]
  instance_class      = var.rds_instance_class
  multi_az            = var.rds_multi_az
  deletion_protection = !var.ephemeral
  skip_final_snapshot = var.ephemeral
}

module "elasticache" {
  source = "../../modules/elasticache"

  name                = "prod"
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.private_subnet_ids
  allowed_cidr_blocks = [module.network.vpc_cidr_block]
  node_type           = var.redis_node_type
}

module "msk" {
  source = "../../modules/msk"

  name                 = "prod"
  vpc_id               = module.network.vpc_id
  subnet_ids           = module.network.private_subnet_ids
  allowed_cidr_blocks  = [module.network.vpc_cidr_block]
  broker_instance_type = var.msk_broker_instance_type
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                       = "prod"
  github_repository          = var.github_repository
  create_oidc_provider       = var.create_github_oidc_provider
  oidc_provider_arn          = var.github_oidc_provider_arn
  allowed_branches           = []
  allowed_environments       = ["production"]
  allow_pull_requests        = false
  ecr_repository_arns        = concat(values(module.ecr.repository_arns), var.dev_ecr_repository_arns)
  eks_cluster_arn            = module.eks.cluster_arn
  terraform_state_bucket_arn = var.terraform_state_bucket_arn
  terraform_lock_table_arn   = var.terraform_lock_table_arn
}

# Let the GitHub Actions CI role authenticate to the prod EKS cluster so
# deploy-prod.yml can run kubectl after aws eks update-kubeconfig.
resource "aws_eks_access_entry" "github_ci" {
  cluster_name  = module.eks.cluster_name
  principal_arn = module.github_oidc.ci_role_arn
  type          = "STANDARD"
}

# Cluster scope is needed because the prod overlay applies cluster-scoped
# objects (ClusterIssuer, ClusterSecretStore); narrow to a namespace scope once
# those move to a separate bootstrap step.
resource "aws_eks_access_policy_association" "github_ci" {
  cluster_name  = module.eks.cluster_name
  principal_arn = module.github_oidc.ci_role_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.github_ci]
}
