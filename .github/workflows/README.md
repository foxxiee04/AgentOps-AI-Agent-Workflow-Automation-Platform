# GitHub Actions

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`ci.yml`](./ci.yml) | Pull request (and `workflow_dispatch`) | PR checks. **quality**: lint, typecheck, test, build, lead eval. **integration**: `pnpm test:integration`. **security**: `pnpm audit --prod` + gitleaks, plus Trivy image scans (`CRITICAL,HIGH`) in the image build matrix. **infra**: hadolint (`pnpm docker:lint`), kubeconform (`pnpm k8s:validate`), terraform validate (`pnpm tf:validate`). |
| [`deploy-dev.yml`](./deploy-dev.yml) | Manual `workflow_dispatch` (skipped while `AWS_CI_ROLE_ARN_DEV` is empty) | Builds the 7 images as `dev/<app>:<sha>` and deploys them to the dev cluster with `scripts/k8s-deploy.sh`. There is no dev cluster at the moment, so it no longer runs on every push. |
| [`deploy-prod.yml`](./deploy-prod.yml) | Push to `main` (docs/markdown ignored), or manual `workflow_dispatch` with an existing `image_tag` to redeploy or roll back | Builds the 7 images (api, tools, web, 4 workers) tagged with the commit id and pushes them to ECR as `prod/<app>:<sha>` (an existing immutable tag is reused). When `PROD_DEPLOY_ENABLED=true` it runs `scripts/k8s-deploy.sh prod`: migration Job, rollout, smoke test of `/health/ready` and `/health/live`, automatic rollback. Both jobs use the `production` environment, which is what the prod CI role trusts. |
| [`terraform-plan.yml`](./terraform-plan.yml) | Pull request touching `infrastructure/terraform/**` or the terraform workflows | Runs `terraform fmt -check`, `tflint`, `validate`, and `plan` for dev and prod, and posts one plan per environment as a pull request comment (updated in place). Skipped while `TF_STATE_BUCKET` is empty (the current prod stack uses local state). |
| [`terraform-apply.yml`](./terraform-apply.yml) | Manual `workflow_dispatch` (choose dev or prod) | Applies Terraform for one environment. Targets the `terraform-dev` / `terraform-prod` environment, so the run pauses on that environment's required reviewers. There is no destroy workflow on purpose. |

## Required GitHub configuration

Repository variables (Settings > Secrets and variables > Actions > **Variables**):

```txt
AWS_REGION
AWS_CI_ROLE_ARN_DEV
AWS_CI_ROLE_ARN_PROD
AWS_TF_PLAN_ROLE_ARN_DEV
AWS_TF_PLAN_ROLE_ARN_PROD
AWS_TF_APPLY_ROLE_ARN_DEV
AWS_TF_APPLY_ROLE_ARN_PROD
DEV_ECR_REGISTRY
PROD_ECR_REGISTRY
EKS_CLUSTER_NAME
DEV_API_URL
PROD_API_URL
TF_STATE_BUCKET
TF_LOCK_TABLE
TF_VARS_DEV
TF_VARS_PROD
```

Delivery to prod also uses these variables:

```txt
PROD_WEB_HOST          public web host, e.g. agentops.mycompany.io
PROD_ACME_EMAIL        optional Let's Encrypt contact address
PROD_DEPLOY_ENABLED    "true" once the runner can reach the EKS API endpoint
```

Repository secrets:

```txt
KUBECONFIG_DEV
PROD_KAFKA_BROKERS     Terraform output kafka_bootstrap_brokers (prod)
PROD_REDIS_URL         Terraform output redis_url (prod)
```

The prod EKS API endpoint only accepts the CIDRs in `eks_public_access_cidrs`. GitHub-hosted runners have no fixed address, so `PROD_DEPLOY_ENABLED` stays unset (images are still built and pushed on every merge) until the endpoint is opened, for example with `eks_public_access_cidrs = ["0.0.0.0/0"]` (authentication still goes through IAM and EKS access entries).

GitHub environments (Settings > Environments), with required reviewers on `production` and both `terraform-*`:

```txt
dev
production
terraform-dev
terraform-prod
```

Branch protection on `main` should require the PR checks (`ci.yml`) to pass before merging.

AWS access uses GitHub OIDC (`id-token: write`) and the `AWS_*_ROLE_ARN_*` variables. No long-lived AWS keys are stored; the only secret is `KUBECONFIG_DEV` for the dev cluster.

Where the role ARNs come from (Terraform outputs):

| Variable | Source | Who can assume it |
| --- | --- | --- |
| `AWS_TF_PLAN_ROLE_ARN_DEV`, `_PROD` | `environments/bootstrap` output `terraform_plan_role_arn` (same role for both) | pull requests (read-only) |
| `AWS_TF_APPLY_ROLE_ARN_DEV`, `_PROD` | `environments/bootstrap` output `terraform_apply_role_arns["dev"/"prod"]` | environments `terraform-dev` / `terraform-prod` |
| `AWS_CI_ROLE_ARN_DEV` | `environments/dev` output `ci_role_arn` | branch `main` |
| `AWS_CI_ROLE_ARN_PROD` | `environments/prod` output `ci_role_arn` | environment `production` |

## Caching

- pnpm store via `actions/setup-node` (`cache: pnpm`).
- `.turbo` via `actions/cache`, keyed on the lockfile hash.
- Docker build layers via the GitHub Actions cache (`type=gha`, per-app scope).

## Local equivalent

```txt
pnpm ci:lint
```

`pnpm ci:lint` runs [actionlint](https://github.com/rhysd/actionlint) over the workflows and [shellcheck](https://www.shellcheck.net/) over `scripts/k8s-deploy.sh` in Docker, the same checks CI relies on.

## Status

These workflows were validated locally with actionlint and shellcheck (`pnpm ci:lint`). They have **not** run on GitHub yet: the first run needs the repository variables above, the GitHub environments, and an AWS account with the OIDC roles, ECR repositories, and EKS cluster.
