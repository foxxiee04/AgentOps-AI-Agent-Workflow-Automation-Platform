terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

module "security" {
  source   = "../../modules/security"
  name     = var.name
  vpc_id   = data.aws_vpc.default.id
  ssh_cidr = var.ssh_cidr
}

module "compute" {
  source             = "../../modules/compute"
  name               = var.name
  ami_id             = var.ami_id
  instance_type      = var.instance_type
  subnet_id          = data.aws_subnets.default.ids[0]
  security_group_ids = [module.security.security_group_id]
  key_name           = var.key_name
}

