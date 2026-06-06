# Apps

Deployable applications live here. Each app should eventually have its own `package.json`, local scripts, Dockerfile, tests, and README.

## Apps

- `web`: Next.js landing page and SaaS dashboard.
- `api`: NestJS modular monolith.
- `workflow-worker`: workflow graph executor.
- `ai-worker`: AI Agent task executor.
- `tool-worker`: webhook/http/email mock executor.
- `notification-worker`: notification executor.

Keep these apps flat under `apps/` so monorepo tooling can discover workspace packages predictably.

