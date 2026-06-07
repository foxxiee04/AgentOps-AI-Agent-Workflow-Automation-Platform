# Database Package

`packages/database` owns Prisma and database assets.

Use it for:

- `schema.prisma`
- migrations
- seed scripts
- database naming conventions
- generated client access pattern

The API and workers should share the same database contract while keeping transaction boundaries explicit.

Useful scripts:

- `pnpm db:generate`: regenerate the Prisma client.
- `pnpm db:push`: push the current schema into the local development database.
- `pnpm db:migrate`: create and apply a development migration.
