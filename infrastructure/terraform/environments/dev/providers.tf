provider "aws" {
  region = var.aws_region

  # The skip_* flags below let `terraform plan` run without AWS credentials or
  # network access. They exist only to validate plans offline and must NEVER be
  # enabled for a real apply.
  skip_credentials_validation = var.offline_plan
  skip_requesting_account_id  = var.offline_plan
  skip_metadata_api_check     = var.offline_plan
  skip_region_validation      = var.offline_plan

  default_tags {
    tags = {
      project    = "agentops"
      env        = var.environment
      owner      = var.owner
      managed-by = "terraform"
    }
  }
}
