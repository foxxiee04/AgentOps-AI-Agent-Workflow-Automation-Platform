import { expect, test } from "@playwright/test";

/**
 * TC-NAV: public pages, locale switch, the auth gate and every app screen.
 * Needs the local stack (demo login for `@agentops.local` accounts).
 */
const appScreens: Array<{ path: string; heading: RegExp }> = [
  { path: "/dashboard", heading: /Workflow operations/ },
  { path: "/workflows", heading: /^Workflows$/ },
  { path: "/runs", heading: /run/i },
  { path: "/approvals", heading: /Emails waiting for approval/ },
  { path: "/agents", heading: /agent/i },
  { path: "/settings", heading: /setting/i }
];

test("TC-NAV-01 landing page renders in English and Vietnamese", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "AI Agent workflow automation platform" })).toBeVisible();
  await page.getByRole("link", { name: "Tiếng Việt" }).click();
  await expect(page).toHaveURL(/\/vi$/);
  await expect(page.getByRole("heading", { name: "Nền tảng tự động hóa workflow bằng AI Agent" })).toBeVisible();
});

test("TC-NAV-02 app screens redirect to login without a session", async ({ page }) => {
  await page.goto("/dashboard?lang=en");
  await expect(page).toHaveURL(/\/login/);
  // The redirect drops the locale, so the form renders in the default language (Vietnamese).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Đăng nhập AgentOps|Log in to AgentOps/);
});

test("TC-NAV-03 login rejects a wrong password format and keeps the user on the form", async ({ page }) => {
  await page.goto("/login?lang=en");
  await page.getByLabel("Email").fill("not-a-member@example.com");
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("form")).toContainText(/⚠/);
});

test("TC-NAV-04 every app screen loads without page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/login?lang=en");
  await page.getByLabel("Email").fill(`nav-${Date.now()}@agentops.local`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const screen of appScreens) {
    await page.goto(`${screen.path}?lang=en`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(screen.heading);
    await expect(page.locator("aside").getByRole("link", { name: /Dashboard/ })).toBeVisible();
  }

  // Sidebar navigation keeps the locale and marks the active section.
  await page.locator("aside").getByRole("link", { name: /Runs/ }).click();
  await expect(page).toHaveURL(/\/runs\?lang=en/);
  await expect(page.locator("aside").getByRole("link", { name: /Runs/ })).toHaveAttribute("aria-current", "page");

  expect(pageErrors).toEqual([]);
});

test("TC-NAV-05 mobile layout shows the top navigation and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?lang=en");
  await page.getByLabel("Email").fill(`mobile-${Date.now()}@agentops.local`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator("header nav").getByRole("link", { name: /Workflows/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
