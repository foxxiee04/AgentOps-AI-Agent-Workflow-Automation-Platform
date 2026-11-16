terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Partial backend configuration. Supply the bucket, key, region, lock table
  # and encryption settings at init time so the same configuration can be
  # reused across accounts without committing them:
  #
  #   terraform init -backend-config=backend.hcl
  #
  # See backend.hcl.example.
  backend "s3" {}
}
