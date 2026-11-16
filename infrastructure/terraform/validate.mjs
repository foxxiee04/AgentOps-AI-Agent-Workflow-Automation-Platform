#!/usr/bin/env node
// Validates the Terraform stacks without touching AWS:
//   1. terraform fmt -check -recursive
//   2. per environment: init (local backend override) -> validate -> offline plan
//      with an allowlist check on the resource types the plan would create
//   3. tflint via Docker (no host install)
//
// Run from anywhere: node infrastructure/terraform/validate.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const tfDir = dirname(fileURLToPath(import.meta.url));
const envs = ["bootstrap", "dev", "prod"];
const region = "ap-southeast-1";
const offlineAmi = "ami-0123456789abcdef0";
const tflintImage = "ghcr.io/terraform-linters/tflint:v0.55.0";

const allowed = JSON.parse(
  readFileSync(join(tfDir, "allowed-resources.json"), "utf8"),
);

let failed = false;

function report(label, ok) {
  if (!ok) failed = true;
  console.log(`${ok ? "ok" : "FAIL"} ${label}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    ...options,
  });
  if (result.error) {
    return { status: 1, stdout: "", stderr: String(result.error) };
  }
  return result;
}

function dump(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stdout.write(result.stderr);
}

// 1. Formatting.
const fmt = run("terraform", ["fmt", "-check", "-recursive"], { cwd: tfDir });
report("terraform fmt", fmt.status === 0);
if (fmt.status !== 0) dump(fmt);

const offlineOverride = `terraform {\n  backend "local" {\n    path = "offline.tfstate"\n  }\n}\n`;

const tables = {};

for (const env of envs) {
  const envDir = join("environments", env);
  const envAbs = join(tfDir, envDir);
  const overridePath = join(envAbs, "offline_override.tf");
  const planPath = join(envAbs, "offline.tfplan");
  const statePath = join(envAbs, "offline.tfstate");
  const lockPath = join(envAbs, ".terraform.lock.hcl");
  const lockExisted = existsSync(lockPath);
  const chdir = `-chdir=${envDir}`;
  const planEnv = {
    ...process.env,
    AWS_ACCESS_KEY_ID: "offline",
    AWS_SECRET_ACCESS_KEY: "offline",
    AWS_REGION: region,
    AWS_EC2_METADATA_DISABLED: "true",
  };

  try {
    // 2a. Force a local backend so init/plan need no S3 access.
    writeFileSync(overridePath, offlineOverride);

    const init = run(
      "terraform",
      [chdir, "init", "-input=false", "-reconfigure"],
      { cwd: tfDir, env: planEnv },
    );
    report(`${env} init`, init.status === 0);
    if (init.status !== 0) {
      dump(init);
      continue;
    }

    // 2b. Validate.
    const validate = run("terraform", [chdir, "validate"], {
      cwd: tfDir,
      env: planEnv,
    });
    report(`${env} validate`, validate.status === 0);
    if (validate.status !== 0) {
      dump(validate);
      continue;
    }

    // 2c. Offline plan.
    const planArgs = [
      chdir,
      "plan",
      "-input=false",
      "-lock=false",
      "-refresh=false",
      "-var-file=terraform.tfvars.example",
      "-var",
      "offline_plan=true",
    ];
    if (env === "dev") planArgs.push("-var", `ami_id=${offlineAmi}`);
    planArgs.push("-out=offline.tfplan");

    const plan = run("terraform", planArgs, { cwd: tfDir, env: planEnv });
    if (plan.status !== 0) {
      report(`${env} plan`, false);
      dump(plan);
      continue;
    }

    const show = run(
      "terraform",
      [chdir, "show", "-json", "offline.tfplan"],
      { cwd: tfDir, env: planEnv },
    );
    if (show.status !== 0) {
      report(`${env} plan`, false);
      dump(show);
      continue;
    }

    const parsed = JSON.parse(show.stdout);
    const counts = new Map();
    const plannedTypes = new Set();
    for (const change of parsed.resource_changes ?? []) {
      if (change.mode === "data") continue;
      const actions = change.change?.actions ?? [];
      const relevant = actions.some(
        (action) => action !== "no-op" && action !== "read",
      );
      if (!relevant) continue;
      const type = change.type;
      plannedTypes.add(type);
      const label = actions.join(",");
      const byAction = counts.get(type) ?? new Map();
      byAction.set(label, (byAction.get(label) ?? 0) + 1);
      counts.set(type, byAction);
    }

    const allow = new Set(allowed[env] ?? []);
    const disallowed = [...plannedTypes].filter((type) => !allow.has(type));

    tables[env] = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, byAction]) => {
        const summary = [...byAction.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([action, count]) => `${action} x${count}`)
          .join(", ");
        return { type, summary };
      });

    if (disallowed.length > 0) {
      report(`${env} plan`, false);
      console.log(
        `  resource type(s) not allowed for ${env}: ${disallowed.join(", ")}`,
      );
    } else {
      report(`${env} plan`, true);
    }
  } finally {
    // 2d. Remove every artefact we created; keep the lock file if it was there.
    for (const path of [overridePath, planPath, statePath]) {
      try {
        rmSync(path, { force: true });
      } catch {
        /* best effort */
      }
    }
    if (!lockExisted) {
      try {
        rmSync(lockPath, { force: true });
      } catch {
        /* best effort */
      }
    }
  }
}

// 3. tflint via Docker.
const pluginDir = mkdtempSync(join(tmpdir(), "agentops-tflint-"));
try {
  const mount = ["-v", `${tfDir}:/data`, "-w", "/data"];
  const plugin = ["-v", `${pluginDir}:/tflint-plugins`];
  const pluginEnv = ["-e", "TFLINT_PLUGIN_DIR=/tflint-plugins"];

  const init = run("docker", [
    "run",
    "--rm",
    ...plugin,
    ...pluginEnv,
    ...mount,
    tflintImage,
    "--init",
    "--config=/data/.tflint.hcl",
  ]);
  report("tflint init", init.status === 0);
  if (init.status !== 0) dump(init);

  for (const env of envs) {
    const lint = run("docker", [
      "run",
      "--rm",
      ...plugin,
      ...pluginEnv,
      ...mount,
      tflintImage,
      "--config=/data/.tflint.hcl",
      `--chdir=/data/environments/${env}`,
      "--call-module-type=all",
    ]);
    report(`tflint ${env}`, lint.status === 0);
    if (lint.status !== 0) dump(lint);
  }
} finally {
  try {
    rmSync(pluginDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// Per-environment resource table.
console.log("\nPlanned resource types per environment:");
for (const env of envs) {
  console.log(`  ${env}:`);
  const rows = tables[env] ?? [];
  if (rows.length === 0) {
    console.log("    (no resources planned)");
    continue;
  }
  const width = Math.max(...rows.map((row) => row.type.length));
  for (const row of rows) {
    console.log(`    ${row.type.padEnd(width)}  ${row.summary}`);
  }
}

process.exit(failed ? 1 : 0);
