import "dotenv/config";
import { execSync } from "node:child_process";
import { assertLocalDatabase, localDatabaseUrl } from "../src/safety";

/**
 * Local-only reset: drops and recreates the schema from the versioned migrations, then runs the
 * required seed and the demo seed. Refuses to run against a non-local host or environment.
 */
const databaseUrl = process.env.DATABASE_URL ?? localDatabaseUrl;

try {
  const url = assertLocalDatabase(databaseUrl, process.env);
  console.log(`Resetting local database ${url.hostname}:${url.port}${url.pathname} ...`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: databaseUrl };
execSync("prisma migrate reset --force", { stdio: "inherit", env });
execSync("tsx scripts/seed-required.ts", { stdio: "inherit", env });
execSync("tsx scripts/seed-demo.ts", { stdio: "inherit", env });
