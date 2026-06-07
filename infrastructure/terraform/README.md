# Terraform

Terraform is organized by reusable modules and environment entrypoints.

```txt
terraform/
  modules/
    network/
    compute/
    ecr/
    security/
    storage/
  environments/
    dev/
    prod/
```

## Recommended Path

For a personal project, prefer the lower-cost path:

```txt
AWS EC2 + k3s + Security Group + optional Elastic IP + optional S3 state bucket
```

Keep EKS/RDS/ElastiCache as an advanced option if budget allows.

The dev environment also creates ECR repositories for application and worker images, so the same image registry can be used by EC2+k3s or EKS.
