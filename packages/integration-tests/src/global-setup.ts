import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { Kafka, logLevel } from "kafkajs";
import { Client } from "pg";
import { kafkaTopics } from "@agentops/events";
import { integrationDatabaseUrl, integrationEnv } from "./env";

/**
 * Prepares a dedicated database (never the developer's `agentops` DB) and the Kafka topics.
 * Additive only: creates what is missing, drops nothing.
 */
export default async function setup() {
  const admin = new Client({ connectionString: integrationEnv.postgresAdminUrl });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [integrationEnv.databaseName]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${integrationEnv.databaseName.replace(/"/g, "")}"`);
    }
  } finally {
    await admin.end();
  }

  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(__dirname, "../../database"),
    env: { ...process.env, DATABASE_URL: integrationDatabaseUrl() },
    stdio: "inherit"
  });

  const kafka = new Kafka({ brokers: integrationEnv.kafkaBrokers.split(","), clientId: "agentops-it-setup", logLevel: logLevel.ERROR });
  const kafkaAdmin = kafka.admin();
  await kafkaAdmin.connect();
  try {
    const topics = new Set(await kafkaAdmin.listTopics());
    const missing = Object.values(kafkaTopics).filter((topic) => !topics.has(topic));
    if (missing.length > 0) {
      await kafkaAdmin.createTopics({
        waitForLeaders: true,
        topics: missing.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 }))
      });
    }
  } finally {
    await kafkaAdmin.disconnect();
  }
}
