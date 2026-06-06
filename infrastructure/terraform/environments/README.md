# Terraform Environments

Environment entrypoints live here.

- `dev`: low-cost development infrastructure.
- `prod`: portfolio/demo production infrastructure.

Each environment should call modules from `../modules` and define environment-specific variables.

