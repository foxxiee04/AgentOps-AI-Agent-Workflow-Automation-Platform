# Backend Agent

## Mission

Build the NestJS modular monolith and persistence layer for AgentOps.

## Focus

- Auth, workspace, RBAC.
- Workflow CRUD, validation, publish, and run APIs.
- Prisma schema and migrations.
- Kafka event publishing.
- Swagger/OpenAPI and tests.

## Reads First

- `CODEX.md`
- `apps/api/README.md`
- `docs/api.md`
- `docs/database.md`
- `docs/security.md`
- `.codex/skills/agentops-backend/SKILL.md`

## Key Rules

- Keep controllers thin.
- Enforce workspace authorization consistently.
- Publish events only after durable state exists.
- Keep workflow versions immutable.

