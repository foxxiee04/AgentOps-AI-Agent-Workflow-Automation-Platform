/** Integration stack = docker compose profile "test" (postgres-test :55433, kafka-test :9095), isolated from the dev stack. */
export const integrationEnv = {
  postgresAdminUrl: process.env.IT_POSTGRES_ADMIN_URL ?? "postgresql://agentops:agentops@localhost:55433/postgres",
  databaseName: process.env.IT_DATABASE_NAME ?? "agentops_integration",
  kafkaBrokers: process.env.IT_KAFKA_BROKERS ?? "localhost:9095"
};

export function integrationDatabaseUrl() {
  const url = new URL(integrationEnv.postgresAdminUrl);
  url.pathname = `/${integrationEnv.databaseName}`;
  return url.toString();
}
