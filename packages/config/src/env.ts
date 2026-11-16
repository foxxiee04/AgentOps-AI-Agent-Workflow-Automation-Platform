import { z } from "zod";

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("postgresql://agentops:agentops@localhost:55432/agentops"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  KAFKA_BROKERS: z.string().min(1).default("localhost:9094"),
  JWT_ACCESS_SECRET: z.string().min(8).default("replace-me-access"),
  JWT_REFRESH_SECRET: z.string().min(8).default("replace-me-refresh"),
  OPENAI_API_KEY: z.string().optional(),
  AI_DAILY_CALL_LIMIT: z.coerce.number().int().positive().optional(),
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  ALERT_BOT_WEBHOOK_URL: z.string().url().optional(),
  ALERTMANAGER_WEBHOOK_TOKEN: z.string().optional(),
  OTEL_ENABLED: z.enum(["true", "false"]).optional(),
  DEMO_LOGIN_ENABLED: z.enum(["true", "false"]).optional(),
  OTEL_DEPLOYMENT_ENVIRONMENT: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().url().optional(),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  API_URL: z.string().url().default("http://localhost:4000"),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().optional(),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().optional(),
  API_TRUST_PROXY: z.string().optional()
});
export type AppEnv = z.infer<typeof appEnvSchema>;

/** Empty values (e.g. `ALERT_BOT_WEBHOOK_URL=` copied from .env.example) count as "not set". */
export function parseAppEnv(env: Record<string, string | undefined>): AppEnv {
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ""));
  return appEnvSchema.parse(defined);
}

export function parseKafkaBrokers(value: string): string[] {
  return value
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}
