# GitHub Actions

Workflow files will live here once the apps are scaffolded.

## Planned Workflows

- `frontend-ci.yml`: lint, typecheck, test, build web.
- `backend-ci.yml`: lint, typecheck, test, build API and workers.
- `docker-build.yml`: build and push Docker images from main.
- `terraform-plan.yml`: run Terraform format, validate, and plan.
- `deploy-k8s.yml`: deploy approved main-branch builds to Kubernetes.

Avoid adding CI workflows that fail before the app packages exist.

