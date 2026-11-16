# Application secret container for AgentOps.
#
# This module intentionally creates only the aws_secretsmanager_secret
# container and NOT an aws_secretsmanager_secret_version. Secret values are
# populated outside Terraform (AWS console or the AWS CLI) so they never land
# in the Terraform state file or in any plan output. Terraform owns the
# container's lifecycle (naming, description, tags, recovery window) while the
# secret material stays out of version control and state.

locals {
  secret_name = "agentops/${var.name}/app"

  expected_keys = [
    "ALERTMANAGER_WEBHOOK_TOKEN",
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "OPENAI_API_KEY",
    "POSTGRES_PASSWORD",
  ]

  description = "AgentOps ${var.name} application secrets. JSON object with keys: ${join(", ", local.expected_keys)}."
}

resource "aws_secretsmanager_secret" "app" {
  name                    = local.secret_name
  description             = local.description
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, { Name = local.secret_name })
}
