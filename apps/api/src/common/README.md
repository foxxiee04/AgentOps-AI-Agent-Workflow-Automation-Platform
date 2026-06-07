# API Common

Shared NestJS API utilities live here.

Use for:

- guards
- decorators
- filters
- interceptors
- validation helpers
- request/correlation ID helpers
- logging helpers

Current HTTP boundary components:

- request ID middleware
- request logging middleware
- HTTP exception filter
- global validation pipe in `main.ts`
- Helmet, CORS, and throttling in the app bootstrap/module

Avoid putting domain-specific business logic here.
