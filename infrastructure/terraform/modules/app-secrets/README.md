# App Secrets Module

Creates the Secrets Manager container for the AgentOps application secrets,
named `agentops/<name>/app`.

The secret is expected to hold a JSON object with the keys:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `OPENAI_API_KEY`
- `POSTGRES_PASSWORD`

Only the container is managed here. No `aws_secretsmanager_secret_version` is
created: secret values are set outside Terraform (console or CLI) so they never
appear in the Terraform state or in any plan output.

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `name` | Environment name for the secret (e.g. `dev`). | `string` | n/a |
| `tags` | Tags applied to the secrets container. | `map(string)` | `{}` |
| `recovery_window_in_days` | Days before a deleted secret is permanently removed. | `number` | `7` |

## Outputs

| Name | Description |
| --- | --- |
| `secret_arn` | ARN of the application secret container. |
| `secret_name` | Name of the application secret container. |
| `secret_arn_prefix` | Wildcard ARN prefix (`arn:aws:secretsmanager:*:*:secret:agentops/<name>/*`) for the EKS IRSA policy. |
