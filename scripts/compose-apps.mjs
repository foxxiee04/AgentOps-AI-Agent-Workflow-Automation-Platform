import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "up";
const extraArgs = process.argv.slice(3);
const composeFiles = ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.apps.yml"];
const argsByMode = {
  up: [...composeFiles, "up", "-d", "--build"],
  down: [...composeFiles, "down"],
  logs: [...composeFiles, "logs", "-f", "api", "web", "workflow-worker", "ai-worker", "tool-worker", "notification-worker"],
  config: [...composeFiles, "config"]
};

const args = argsByMode[mode] ? [...argsByMode[mode], ...extraArgs] : undefined;
if (!args) {
  console.error(`Unknown compose app mode: ${mode}`);
  process.exit(1);
}

const result = spawnSync("docker", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    COMPOSE_BAKE: "false"
  }
});

process.exit(result.status ?? 1);
