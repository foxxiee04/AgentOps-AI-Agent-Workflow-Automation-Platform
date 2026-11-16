# Dev is the low-cost environment: a single k3s EC2 node with the data services
# (PostgreSQL, Redis, Kafka) running in-cluster. There are no AWS data service
# lookups here, so no `aws_vpc`, `aws_subnets`, `aws_ami` or `aws_caller_identity`
# data sources are used.

module "network" {
  source = "../../modules/network"

  name                 = "agentops-dev"
  cidr_block           = "10.20.0.0/16"
  azs                  = var.azs
  public_subnet_cidrs  = ["10.20.0.0/24", "10.20.1.0/24"]
  private_subnet_cidrs = ["10.20.10.0/24", "10.20.11.0/24"]
  enable_nat           = false
}

module "ecr" {
  source = "../../modules/ecr"

  name = "dev"
}

module "app_secrets" {
  source = "../../modules/app-secrets"

  name = "dev"
}

module "k3s" {
  source = "../../modules/k3s"

  name              = "agentops-dev"
  vpc_id            = module.network.vpc_id
  subnet_id         = module.network.public_subnet_ids[0]
  ami_id            = var.ami_id
  instance_type     = var.instance_type
  admin_cidr_blocks = var.admin_cidr_blocks
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                       = "dev"
  github_repository          = var.github_repository
  create_oidc_provider       = var.create_github_oidc_provider
  oidc_provider_arn          = var.github_oidc_provider_arn
  allowed_branches           = ["main"]
  allowed_environments       = []
  allow_pull_requests        = false
  ecr_repository_arns        = values(module.ecr.repository_arns)
  terraform_state_bucket_arn = var.terraform_state_bucket_arn
  terraform_lock_table_arn   = var.terraform_lock_table_arn
}
