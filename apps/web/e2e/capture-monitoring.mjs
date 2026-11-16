// Captures documentation screenshots of the monitoring stack (Grafana, Prometheus, Alertmanager).
// Grafana must allow anonymous viewing or already be reachable without a login page.
//
//   kubectl -n monitoring port-forward svc/grafana 3002:3000
//   kubectl -n monitoring port-forward svc/prometheus 9091:9090
//   kubectl -n monitoring port-forward svc/alertmanager 9094:9093
//   cd apps/web && node e2e/capture-monitoring.mjs
//
// Environment: GRAFANA_URL, PROMETHEUS_URL, ALERTMANAGER_URL, SHOT_OUT_DIR, SHOT_RANGE (default now-1h).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const grafana = (process.env.GRAFANA_URL ?? "http://localhost:3002").replace(/\/$/, "");
const prometheus = (process.env.PROMETHEUS_URL ?? "http://localhost:9091").replace(/\/$/, "");
const alertmanager = (process.env.ALERTMANAGER_URL ?? "http://localhost:9094").replace(/\/$/, "");
const outDir = resolve(process.env.SHOT_OUT_DIR ?? "../../docs/images/monitoring");
const range = process.env.SHOT_RANGE ?? "now-1h";

mkdirSync(outDir, { recursive: true });

const dashboards = ["agentops-overview", "agentops-red", "agentops-ai", "agentops-kafka", "agentops-business"];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const page = await context.newPage();

async function shot(name, url, { fullPage = true, wait = 5000 } = {}) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage });
    console.log(`captured ${name}`);
  } catch (error) {
    console.log(`skipped ${name}: ${error.message.split("\n")[0]}`);
  }
}

// Grafana renders panels lazily, so dashboards use a tall viewport instead of a full-page capture.
await page.setViewportSize({ width: 1600, height: 1700 });
for (const [index, uid] of dashboards.entries()) {
  await shot(`grafana-${index + 1}-${uid.replace("agentops-", "")}`, `${grafana}/d/${uid}?kiosk&from=${range}&to=now&refresh=`, { fullPage: false, wait: 8000 });
}
await page.setViewportSize({ width: 1600, height: 1000 });

const explore = encodeURIComponent(
  JSON.stringify({ a: { datasource: "tempo", queries: [{ refId: "A", queryType: "traceqlSearch", limit: 20, filters: [] }], range: { from: range, to: "now" } } })
);
await shot("grafana-6-tempo-traces", `${grafana}/explore?schemaVersion=1&panes=${explore}&orgId=1`, { fullPage: false, wait: 8000 });

await shot("prometheus-targets", `${prometheus}/targets`, { wait: 3000 });
await shot("prometheus-alert-rules", `${prometheus}/alerts`, { wait: 3000 });
await shot("alertmanager", `${alertmanager}/#/alerts`, { fullPage: false, wait: 3000 });

await browser.close();
