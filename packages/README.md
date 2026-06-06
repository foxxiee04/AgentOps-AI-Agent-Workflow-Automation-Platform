# Packages

Shared packages live here. Extract into a shared package only when more than one app needs the code or contract.

## Packages

- `shared`: common enums, validation schemas, DTO-like types, utility helpers.
- `events`: Kafka event names, envelope types, payload schemas, producer/consumer helpers.
- `config`: shared env validation and configuration helpers.
- `database`: Prisma schema, migrations, seed data, and generated client access pattern.
- `ui`: reusable UI primitives and composed components.

