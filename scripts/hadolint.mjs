#!/usr/bin/env node
// Lints the production Dockerfiles with hadolint (Docker image, no local install needed).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dockerfiles = ["api", "worker", "web"].map((name) => `infrastructure/docker/${name}.Dockerfile`);
const config = readFileSync(resolve(root, ".hadolint.yaml"), "utf8");

let failed = false;
for (const file of dockerfiles) {
  // The config is passed inline (base64) so no volume mount (and no Windows path translation) is needed.
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-i",
      "--entrypoint",
      "sh",
      "hadolint/hadolint:v2.12.0-alpine",
      "-c",
      `echo "${Buffer.from(config).toString("base64")}" | base64 -d > /tmp/hadolint.yaml && hadolint --config /tmp/hadolint.yaml -`
    ],
    { input: readFileSync(resolve(root, file)), encoding: "utf8" }
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  console.log(`${result.status === 0 ? "ok  " : "FAIL"} ${file}${output ? `\n${output}` : ""}`);
  failed ||= result.status !== 0;
}

process.exit(failed ? 1 : 0);
