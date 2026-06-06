# Dev Terraform Environment

Low-cost development infrastructure entrypoint.

Use for:

- EC2 + k3s experiments.
- minimal security group setup.
- disposable demo deployments.

Copy `terraform.tfvars.example` to `terraform.tfvars`, fill in an AMI id, key pair, and SSH CIDR, then run `terraform plan`.
