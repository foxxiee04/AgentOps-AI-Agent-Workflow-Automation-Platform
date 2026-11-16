#!/usr/bin/env node
// Renders each Kubernetes target with kustomize (in Docker) and validates the
// result with kubeconform (in Docker). No host dependencies beyond Docker.
//
// Run: node infrastructure/k8s/validate.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const k8sDir = dirname(fileURLToPath(import.meta.url));

const targets = ["overlays/dev", "overlays/prod", "jobs/db-migrate"];

let failed = false;

for (const target of targets) {
  const render = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${k8sDir}:/k8s`,
      "registry.k8s.io/kustomize/kustomize:v5.6.0",
      "build",
      `/k8s/${target}`,
    ],
    { encoding: "utf8", maxBuffer: 20e6 },
  );

  if (render.status !== 0) {
    failed = true;
    console.log(`FAIL ${target}`);
    if (render.stderr) process.stdout.write(render.stderr);
    continue;
  }

  const validate = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-i",
      "ghcr.io/yannh/kubeconform:v0.6.7",
      "-strict",
      "-summary",
      "-kubernetes-version",
      "1.31.0",
      "-schema-location",
      "default",
      "-schema-location",
      "https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json",
      "-",
    ],
    { input: render.stdout, encoding: "utf8", maxBuffer: 20e6 },
  );

  if (validate.status !== 0) {
    failed = true;
    console.log(`FAIL ${target}`);
  } else {
    console.log(`ok ${target}`);
  }
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stdout.write(validate.stderr);
}

process.exit(failed ? 1 : 0);
