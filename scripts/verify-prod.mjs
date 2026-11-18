#!/usr/bin/env node
// Production verification: endpoints and TLS, Kubernetes workloads and autoscaling, Prometheus targets/rules/
// business metrics, an end-to-end alert (Alertmanager -> webhook -> API metric) and a distributed trace in Tempo.
// Read-only except for one synthetic "AgentOpsVerifyProbe" info alert. Prints a Markdown report to stdout.
//
// Usage:
//   KUBECONFIG=<prod kubeconfig> node scripts/verify-prod.mjs --host agentops.<ip-dashed>.sslip.io > report.md
// Options: --host <web host> (required), --namespace agentops, --monitoring monitoring, --skip-alert
import { execFileSync } from "node:child_process";
import tls from "node:tls";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const host = option("host");
const ns = option("namespace", "agentops");
const mon = option("monitoring", "monitoring");
const skipAlert = args.includes("--skip-alert");
if (!host) {
  console.error("usage: node scripts/verify-prod.mjs --host agentops.<ip>.sslip.io");
  process.exit(2);
}

const results = [];
const check = (area, name, ok, detail = "") => results.push({ area, name, ok, detail });
const kubectl = (...argv) => execFileSync("kubectl", argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const kjson = (...argv) => JSON.parse(kubectl(...argv, "-o", "json"));
const inPod = (namespace, target, url, extra = []) =>
  kubectl("-n", namespace, "exec", target, "--", "wget", "-qO-", ...extra, url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function http(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual" });
    return { status: response.status, ms: Date.now() - started, body: await response.text() };
  } catch (error) {
    return { status: 0, ms: Date.now() - started, body: String(error) };
  }
}

function certificate(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve({ authorized: socket.authorized, issuer: cert.issuer?.O ?? cert.issuer?.CN, validTo: cert.valid_to });
    });
    socket.on("error", (error) => resolve({ authorized: false, error: String(error) }));
  });
}

const prom = (path) => JSON.parse(inPod(mon, "deploy/prometheus", `http://localhost:9090${path}`));
const promValue = (query) => {
  const data = prom(`/api/v1/query?query=${encodeURIComponent(query)}`).data.result;
  return data.reduce((sum, row) => sum + Number(row.value[1]), 0);
};

// 1. Endpoints and TLS
const api = `https://api.${host}`;
for (const [name, url, expected] of [
  ["web landing", `https://${host}/vi`, 200],
  ["API readiness (postgres, redis, kafka)", `${api}/health/ready`, 200],
  ["API liveness", `${api}/health/live`, 200],
  ["protected route without session", `${api}/auth/me`, 401],
  ["admin route without session", `${api}/admin/overview`, 401],
  ["metrics are not public", `${api}/metrics`, 404]
]) {
  const response = await http(url);
  check("Endpoints", name, response.status === expected, `HTTP ${response.status} in ${response.ms} ms (expected ${expected})`);
}
for (const hostname of [host, `api.${host}`]) {
  const cert = await certificate(hostname);
  const daysLeft = cert.validTo ? Math.round((new Date(cert.validTo) - Date.now()) / 86_400_000) : -1;
  check("TLS", `certificate for ${hostname}`, cert.authorized && daysLeft > 7, `${cert.issuer ?? cert.error}, ${daysLeft} days left`);
}

// 2. Workloads and autoscaling
const deployments = kjson("-n", ns, "get", "deploy").items;
for (const deployment of deployments) {
  const ready = deployment.status.readyReplicas ?? 0;
  // Short commit tag: a full 40-character SHA in the report trips gitleaks' generic-api-key rule.
  const image = deployment.spec.template.spec.containers[0].image.split("/").pop().replace(/:([0-9a-f]{12})[0-9a-f]{28}$/, ":$1");
  check("Workloads", deployment.metadata.name, ready >= 1 && ready === deployment.spec.replicas, `${ready}/${deployment.spec.replicas} ready, ${image}`);
}
const pods = kjson("-n", ns, "get", "pods").items.filter((pod) => pod.status.phase === "Running");
const restarts = pods.reduce((sum, pod) => sum + (pod.status.containerStatuses ?? []).reduce((s, c) => s + c.restartCount, 0), 0);
check("Workloads", "running pods and restarts", pods.length > 0, `${pods.length} running pods, ${restarts} restarts in total`);
const hpas = kjson("-n", ns, "get", "hpa").items;
check("Autoscaling", "horizontal pod autoscalers", hpas.length > 0, hpas.map((h) => `${h.metadata.name} ${h.status.currentReplicas}/${h.spec.maxReplicas}`).join(", "));
try {
  const scaled = kjson("-n", ns, "get", "scaledobjects.keda.sh").items;
  check("Autoscaling", "KEDA scaled objects (Kafka lag)", scaled.length > 0, scaled.map((s) => `${s.metadata.name}: ${s.status?.conditions?.find((c) => c.type === "Ready")?.status ?? "?"}`).join(", "));
} catch {
  check("Autoscaling", "KEDA scaled objects (Kafka lag)", false, "KEDA CRD not reachable");
}

// 3. Prometheus
const targets = prom("/api/v1/targets?state=active").data.activeTargets;
const byJob = {};
for (const target of targets) {
  const job = target.labels.job;
  byJob[job] ??= { up: 0, total: 0 };
  byJob[job].total += 1;
  byJob[job].up += target.health === "up" ? 1 : 0;
}
check("Prometheus", "scrape targets up", targets.every((t) => t.health === "up"), Object.entries(byJob).map(([job, c]) => `${job} ${c.up}/${c.total}`).join(", "));
const groups = prom("/api/v1/rules").data.groups;
check("Prometheus", "alert rules loaded", groups.length > 0, `${groups.length} groups, ${groups.reduce((s, g) => s + g.rules.length, 0)} rules`);
const firing = prom("/api/v1/alerts").data.alerts.filter((a) => a.state === "firing" && a.labels.severity !== "info");
check("Prometheus", "no warning/critical alert firing", firing.length === 0, firing.map((a) => a.labels.alertname).join(", ") || "none");
for (const [name, query] of [
  ["API requests served (5m)", "sum(increase(agentops_http_requests_total[5m]))"],
  ["worker messages consumed since start", "sum(agentops_worker_messages_consumed_total)"],
  ["Kafka consumer lag (all groups)", "sum(agentops_kafka_consumer_lag)"],
  ["users known to the platform", "max(agentops_users_total)"]
]) {
  try {
    const value = promValue(query);
    check("Prometheus", name, value >= 0, `${query} = ${Math.round(value)}`);
  } catch (error) {
    check("Prometheus", name, false, String(error).slice(0, 120));
  }
}

// 4. Alert chain: Alertmanager -> POST /notifications/alertmanager -> agentops_alertmanager_notifications_total
if (!skipAlert) {
  // The scrape relabels `service`, so count every firing notification before and after the probe.
  const probeQuery = 'sum(agentops_alertmanager_notifications_total{status="firing"})';
  const before = promValue(probeQuery);
  // A unique alert name per run: Alertmanager groups by alertname and would not resend an identical probe
  // within repeat_interval (2 h).
  const probeName = `AgentOpsVerifyProbe${Date.now()}`;
  const alert = JSON.stringify([{ labels: { alertname: probeName, severity: "info", service: "verify" }, annotations: { summary: "verify-prod.mjs end-to-end alert probe" } }]);
  inPod(mon, "deploy/alertmanager", "http://localhost:9093/api/v2/alerts", ["--header", "Content-Type: application/json", "--post-data", alert]);
  let after = before;
  for (let attempt = 0; attempt < 12 && after <= before; attempt += 1) {
    await sleep(10_000);
    after = promValue(probeQuery);
  }
  check("Alerting", "Alertmanager delivers to the API webhook", after > before, `firing notifications ${before} -> ${after}`);
}

// 5. Tempo: traced services over 24 h and one trace that crosses the Kafka boundary into a worker
try {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 86_400;
  const tempo = (path) => JSON.parse(inPod(mon, "deploy/tempo", `http://localhost:3200${path}`));
  const services = tempo(`/api/search/tag/service.name/values?start=${start}&end=${end}`).tagValues ?? [];
  check("Tracing", "services exporting traces (24 h)", services.length >= 2, services.join(", "));
  const query = encodeURIComponent('{ resource.service.name = "agentops-ai-worker" }');
  const traces = tempo(`/api/search?q=${query}&start=${start}&end=${end}&limit=10`).traces ?? [];
  let best = { services: [], id: "", spans: 0 };
  for (const trace of traces.slice(0, 10)) {
    const detail = tempo(`/api/traces/${trace.traceID}`);
    const names = new Set();
    let spans = 0;
    for (const batch of detail.batches ?? detail.resourceSpans ?? []) {
      const attr = (batch.resource?.attributes ?? []).find((a) => a.key === "service.name");
      if (attr) names.add(attr.value.stringValue);
      for (const scope of batch.scopeSpans ?? batch.instrumentationLibrarySpans ?? []) spans += (scope.spans ?? []).length;
    }
    if (names.size > best.services.length) best = { services: [...names], id: trace.traceID, spans };
  }
  check("Tracing", "one lead run traced across services", best.services.length >= 2, best.id ? `${best.id.slice(0, 16)}: ${best.spans} spans over ${best.services.join(", ")}` : "no ai-worker trace in 24 h");
} catch (error) {
  check("Tracing", "Tempo reachable", false, String(error).slice(0, 160));
}

// Report
const passed = results.filter((r) => r.ok).length;
const lines = [
  `# Production verification - ${new Date().toISOString()}`,
  "",
  `Host: \`${host}\` - ${passed}/${results.length} checks passed.`,
  ""
];
let area = "";
for (const result of results) {
  if (result.area !== area) {
    area = result.area;
    lines.push("", `## ${area}`, "", "| Check | Result | Detail |", "| --- | --- | --- |");
  }
  lines.push(`| ${result.name} | ${result.ok ? "PASS" : "FAIL"} | ${result.detail.replace(/\|/g, "/")} |`);
}
console.log(lines.join("\n"));
process.exit(passed === results.length ? 0 : 1);
