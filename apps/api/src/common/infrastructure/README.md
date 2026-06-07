# API Infrastructure

Shared infrastructure clients for the NestJS API live here.

Current clients:

- `PrismaService`: owns the Prisma client lifecycle and PostgreSQL readiness ping.
- `RedisHealthService`: owns a lightweight Redis client for readiness checks.
- `KafkaAdminService`: owns a Kafka admin client for broker readiness checks.

Keep this folder focused on cross-module platform dependencies. Domain persistence and business queries should live in the owning feature module.
