import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = join(repoRoot, "tests", "load");
const outDir = join(repoRoot, "reports", "load");

const API_URL = process.env.API_URL ?? "http://host.docker.internal:4000";
const ITERATIONS = process.env.ITERATIONS ?? "1000";
const VUS = process.env.VUS ?? "20";

mkdirSync(outDir, { recursive: true });

console.warn(
  [
    "WARNING: before running this load test, make sure the API is configured with:",
    "  - API_RATE_LIMIT_PER_MINUTE raised (e.g. 100000)",
    "  - AI_DAILY_CALL_LIMIT raised (e.g. 10000)",
    "The lead qualification workflow uses the mock AI provider, so no OpenAI API cost is incurred.",
    ""
  ].join("\n")
);

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "-i",
    "-v",
    `${scriptsDir}:/scripts`,
    "-v",
    `${outDir}:/out`,
    "-e",
    "API_URL",
    "-e",
    "ITERATIONS",
    "-e",
    "VUS",
    "grafana/k6:0.54.0",
    "run",
    "/scripts/lead-trigger.k6.js"
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      API_URL,
      ITERATIONS,
      VUS
    }
  }
);

process.exit(result.status ?? 1);
