# ECR Module

Creates one AWS ECR repository per deployable AgentOps image, named
`<name>/<app>` (for example `dev/api`).

Each repository:

- uses immutable image tags,
- scans images on push,
- encrypts images with AES256,
- keeps the last `image_retention_count` tagged images and expires untagged
  images after 7 days.

`force_delete` is disabled so repositories cannot be deleted while they still
contain images.

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `name` | Environment prefix for the repositories. | `string` | n/a |
| `tags` | Tags applied to all resources. | `map(string)` | `{}` |
| `repositories` | Application image repository names. | `list(string)` | `["api", "web", "tools", "workflow-worker", "ai-worker", "tool-worker", "notification-worker"]` |
| `image_retention_count` | Tagged images to retain per repository. | `number` | `30` |

## Outputs

| Name | Description |
| --- | --- |
| `repository_urls` | Map of application name to repository URL. |
| `repository_arns` | Map of application name to repository ARN. |
