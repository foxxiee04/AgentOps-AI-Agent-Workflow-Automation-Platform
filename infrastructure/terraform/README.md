# Terraform

Terraform is organized by reusable modules and environment entrypoints.

```txt
terraform/
  modules/
    network/
    compute/
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

