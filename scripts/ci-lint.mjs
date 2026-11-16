#!/usr/bin/env node
// Lints the GitHub Actions workflows (actionlint) and the deploy shell script
// (shellcheck) using Docker images, so no local install is needed.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// spawnSync is called with an args array: the repo path contains spaces on
// Windows, so it must stay a single argument (no shell string splitting).
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  {
    name: "actionlint",
    args: ["run", "--rm", "-v", `${root}:/repo`, "-w", "/repo", "rhysd/actionlint:1.7.7", "-color"],
  },
  {
    name: "shellcheck",
    args: ["run", "--rm", "-v", `${root}:/mnt`, "koalaman/shellcheck:v0.10.0", "/mnt/scripts/k8s-deploy.sh"],
  },
];

let failed = false;
for (const step of steps) {
  const result = spawnSync("docker", step.args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const status = result.status === 0 ? "ok  " : "FAIL";
  console.log(`${status} ${step.name}${output ? `\n${output}` : ""}`);
  failed ||= result.status !== 0;
}

process.exit(failed ? 1 : 0);
