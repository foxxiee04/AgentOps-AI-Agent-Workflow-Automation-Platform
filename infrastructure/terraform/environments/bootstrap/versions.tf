terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # This stack deliberately has NO backend block. It creates the S3 bucket and
  # DynamoDB table that every other stack uses as its remote backend, so it must
  # be applied once per AWS account with local state before those backends
  # exist. Run it with local state, then configure the remote backends in the
  # other environments.
}
