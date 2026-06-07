# API Modules

NestJS domain modules live here.

Each mature module should usually contain:

- controller
- service
- DTOs/schemas
- policy/guard helpers when needed
- tests

Keep modules cohesive and avoid cross-module imports that create circular dependencies.

## Route Groups

Current public route groups:

- `/health`: liveness and readiness checks.
- `/auth`: authentication/session mock endpoints.
- `/workspaces`: workspace and member APIs.
- `/workflows`: workflow CRUD, publish, and run APIs.
- `/workflow-runs`: run detail and step APIs.
- `/ai`: provider status, AI node test, evaluation, task lookup, usage.
- `/webhooks`: webhook endpoint management and mock ingestion.
- `/dashboard`: overview metrics and recent activity.
- `/notifications`: notification list and mock actions.
- `/audit`: audit-log mock endpoints.

Keep these groups stable for the MVP. A future production API prefix such as `/api/v1` should be introduced only with matching frontend, Postman, and docs updates.
