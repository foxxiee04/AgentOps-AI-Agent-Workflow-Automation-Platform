# API Modules

NestJS domain modules live here.

Each mature module should usually contain:

- controller
- service
- DTOs/schemas
- policy/guard helpers when needed
- tests

Keep modules cohesive and avoid cross-module imports that create circular dependencies.

