import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { integrationEnv } from "./env";

/**
 * Applies the versioned migrations to a brand-new database and checks indexes and constraints.
 * The database is created by this test and dropped afterwards; no other database is touched.
 */
const databaseName = `agentops_migrate_check_${Date.now()}`;
let client: Client;

function urlFor(database: string) {
  const url = new URL(integrationEnv.postgresAdminUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

beforeAll(async () => {
  const admin = new Client({ connectionString: integrationEnv.postgresAdminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(__dirname, "../../database"),
    env: { ...process.env, DATABASE_URL: urlFor(databaseName) },
    stdio: "pipe"
  });

  client = new Client({ connectionString: urlFor(databaseName) });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
  const admin = new Client({ connectionString: integrationEnv.postgresAdminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
});

describe("versioned migrations on an empty database", () => {
  it("applies every migration", async () => {
    const applied = await client.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`);
    // Every migration folder in packages/database, so a new migration does not need a test edit.
    const migrationsDir = resolve(__dirname, "../../database/prisma/migrations");
    const expected = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(expected.length).toBeGreaterThanOrEqual(3);
    expect(applied.rows.map((row) => row.migration_name)).toEqual(expected);
  });

  it("creates the indexes used by hot queries", async () => {
    const result = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`);
    const indexes = new Set(result.rows.map((row) => row.indexname as string));

    for (const name of [
      "WorkflowRun_workspaceId_createdAt_idx",
      "WorkflowRun_workflowId_createdAt_idx",
      "WorkflowRun_status_createdAt_idx",
      "WorkflowStepRun_workflowRunId_nodeId_key",
      "DomainEvent_workflowRunId_createdAt_idx",
      "DomainEvent_kafkaPublishedAt_createdAt_idx",
      "UsageRecord_workspaceId_createdAt_idx",
      "Notification_workspaceId_type_createdAt_idx",
      "HumanApproval_workspaceId_status_requestedAt_idx",
      "ProcessedMessage_consumerGroup_idempotencyKey_key",
      "AiTaskResult_workflowRunId_nodeId_key"
    ]) {
      expect(indexes, name).toContain(name);
    }
  });

  it("enforces the idempotency and one-per-node unique constraints", async () => {
    await client.query(
      `INSERT INTO "ProcessedMessage" (id, "consumerGroup", "idempotencyKey", "eventId", outcome) VALUES ('pm1', 'g', 'run:ai-1:agent-task-requested', 'evt1', 'processed')`
    );
    await expect(
      client.query(
        `INSERT INTO "ProcessedMessage" (id, "consumerGroup", "idempotencyKey", "eventId", outcome) VALUES ('pm2', 'g', 'run:ai-1:agent-task-requested', 'evt2', 'processed')`
      )
    ).rejects.toMatchObject({ code: "23505" });

    // Same key in another consumer group is allowed.
    await client.query(
      `INSERT INTO "ProcessedMessage" (id, "consumerGroup", "idempotencyKey", "eventId", outcome) VALUES ('pm3', 'other', 'run:ai-1:agent-task-requested', 'evt3', 'processed')`
    );
  });

  it("enforces foreign keys with intentional cascades", async () => {
    await client.query(`INSERT INTO "User" (id, email, "passwordHash", name, "updatedAt") VALUES ('u1', 'u1@x.test', 'h', 'U', now())`);
    await client.query(`INSERT INTO "Workspace" (id, name, slug, "ownerId", "updatedAt") VALUES ('w1', 'W', 'w1', 'u1', now())`);
    await client.query(
      `INSERT INTO "Workflow" (id, "workspaceId", name, "definitionJson", "createdById", "updatedAt") VALUES ('wf1', 'w1', 'WF', '{}', 'u1', now())`
    );
    await client.query(
      `INSERT INTO "WorkflowVersion" (id, "workflowId", "versionNumber", "definitionJson", "createdById") VALUES ('v1', 'wf1', 1, '{}', 'u1')`
    );
    await client.query(
      `INSERT INTO "WorkflowRun" (id, "workflowId", "workflowVersionId", "workspaceId", "triggerType", "inputJson") VALUES ('r1', 'wf1', 'v1', 'w1', 'manual', '{}')`
    );
    await client.query(
      `INSERT INTO "HumanApproval" (id, "workspaceId", "workflowRunId", "nodeId", "decidedById") VALUES ('a1', 'w1', 'r1', 'approval-1', 'u1')`
    );

    // Unique per run + node.
    await expect(
      client.query(`INSERT INTO "HumanApproval" (id, "workspaceId", "workflowRunId", "nodeId") VALUES ('a2', 'w1', 'r1', 'approval-1')`)
    ).rejects.toMatchObject({ code: "23505" });

    // Domain events must point at an existing run.
    await expect(
      client.query(`INSERT INTO "DomainEvent" (id, type, "workspaceId", "workflowRunId", "payloadJson") VALUES ('e1', 'x', 'w1', 'missing', '{}')`)
    ).rejects.toMatchObject({ code: "23503" });

    // A published version cannot be deleted while runs reference it.
    await expect(client.query(`DELETE FROM "WorkflowVersion" WHERE id = 'v1'`)).rejects.toMatchObject({ code: "23503" });

    // Deleting the workspace cascades to its runs and approvals.
    await client.query(`DELETE FROM "Workspace" WHERE id = 'w1'`);
    const remaining = await client.query(`SELECT count(*)::int AS n FROM "HumanApproval"`);
    expect(remaining.rows[0].n).toBe(0);
  });
});
