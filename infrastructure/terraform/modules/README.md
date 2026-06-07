# Terraform Modules

Reusable Terraform modules live here.

Each module should eventually include:

- `main.tf`
- `variables.tf`
- `outputs.tf`
- module-specific README if the module becomes non-trivial

Keep modules small and composable.

Current modules:

- `compute`: EC2/k3s host resources.
- `ecr`: container image repositories for apps and workers.
- `security`: security groups and network access.
- `storage`: storage primitives.
