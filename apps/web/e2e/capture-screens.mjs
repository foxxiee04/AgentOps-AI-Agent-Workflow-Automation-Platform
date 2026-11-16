// Captures documentation screenshots of the main screens against a running stack.
//
//   cd apps/web
//   SHOT_EMAIL=operator@agentops.local SHOT_PASSWORD=password123 node e2e/capture-screens.mjs
//
// Environment:
//   SHOT_BASE_URL   web app URL (default http://localhost:3000)
//   SHOT_OUT_DIR    output directory (default ../../docs/images/app)
//   SHOT_LOCALE     en | vi (default en)
//   SHOT_ONLY       comma-separated screen names to capture (default: all)
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.SHOT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const outDir = resolve(process.env.SHOT_OUT_DIR ?? "../../docs/images/app");
const locale = process.env.SHOT_LOCALE ?? "en";
const only = process.env.SHOT_ONLY ? new Set(process.env.SHOT_ONLY.split(",")) : undefined;
const email = process.env.SHOT_EMAIL;
const password = process.env.SHOT_PASSWORD;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();

async function shot(name, path, { fullPage = false, prepare } = {}) {
  if (only && !only.has(name)) {
    return;
  }
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" }).catch(() => page.goto(`${baseUrl}${path}`));
  if (prepare) {
    await prepare();
  }
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage });
  console.log(`captured ${name}`);
}

await shot("01-landing", `/${locale}`, { fullPage: true });
await shot("02-login", `/login?lang=${locale}`, { fullPage: false });

if (email && password) {
  await page.goto(`${baseUrl}/login?lang=${locale}`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([page.waitForURL(/\/dashboard/), page.locator('form button[type="submit"]').click()]);

  await shot("03-dashboard", `/dashboard?lang=${locale}`);
  await shot("04-workflows", `/workflows?lang=${locale}`);
  await shot("05-builder", `/workflows/wf_lead_qualification/builder?lang=${locale}`, { fullPage: false });
  await shot("06-runs", `/runs?lang=${locale}`);

  // Open the newest completed run for the timeline screenshot.
  await page.goto(`${baseUrl}/runs?lang=${locale}&status=COMPLETED`, { waitUntil: "networkidle" }).catch(() => undefined);
  const runHref = await page
    .locator('a[href*="/runs/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (runHref) {
    await shot("07-run-detail", runHref.startsWith("http") ? runHref.replace(baseUrl, "") : runHref);
  }

  await shot("08-approvals", `/approvals?lang=${locale}`);
  await shot("09-agents", `/agents?lang=${locale}`);
  await shot("10-settings", `/settings?lang=${locale}`);

  await context.close();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: undefined });
  const mobilePage = await mobile.newPage();
  if (!only || only.has("11-mobile-dashboard")) {
    await mobilePage.goto(`${baseUrl}/login?lang=${locale}`);
    await mobilePage.locator('input[type="email"]').fill(email);
    await mobilePage.locator('input[type="password"]').fill(password);
    await Promise.all([mobilePage.waitForURL(/\/dashboard/), mobilePage.locator('form button[type="submit"]').click()]);
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({ path: resolve(outDir, "11-mobile-dashboard.png"), fullPage: false });
    console.log("captured 11-mobile-dashboard");
  }
  await mobile.close();
} else {
  console.log("SHOT_EMAIL / SHOT_PASSWORD not set: captured public pages only.");
}

await browser.close();
