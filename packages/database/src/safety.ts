/** Default local compose database (same as prisma.config.ts). */
export const localDatabaseUrl = "postgresql://agentops:agentops@localhost:55432/agentops";

/** Hosts that only exist on a developer machine or inside the local docker compose network. */
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "host.docker.internal"]);
const nonLocalEnvironments = new Set(["production", "prod", "staging", "dev", "development-cloud"]);

/**
 * Destructive commands (db:reset) run only against a local database in a local environment.
 * Throws with the reason otherwise.
 */
export function assertLocalDatabase(databaseUrl: string | undefined, env: Record<string, string | undefined>): URL {
  if (!databaseUrl) {
    throw new Error("Refusing to reset: DATABASE_URL is not set.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing to reset: DATABASE_URL is not a valid URL.");
  }

  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing to reset: database host '${url.hostname}' is not local.`);
  }

  const appEnv = (env["APP_ENV"] ?? "local").toLowerCase();
  if (appEnv !== "local" || nonLocalEnvironments.has(appEnv)) {
    throw new Error(`Refusing to reset: APP_ENV is '${appEnv}', only 'local' is allowed.`);
  }
  if (env["NODE_ENV"] === "production") {
    throw new Error("Refusing to reset: NODE_ENV is 'production'.");
  }

  return url;
}
