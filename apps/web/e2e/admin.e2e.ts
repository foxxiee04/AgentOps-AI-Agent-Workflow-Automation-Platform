import { readFile } from "node:fs/promises";
import { expect, request as apiRequest, test, type Page } from "@playwright/test";

/**
 * TC-ADM: the platform admin console against the local stack.
 * `operator@agentops.local` is a platform admin; every other account is a regular user.
 * The auth endpoints are rate limited, so the operator session is created once per file.
 */
const webUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type AuthUser = { id: string; email: string; name: string };
type Session = { user: AuthUser; accessToken: string };

let admin: Session | undefined;
let nonAdmin: Session | undefined;

function uniqueEmail(purpose: string) {
  return `e2e-${purpose}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
}

/**
 * Runs one auth call in a throw-away context. Keeping it cookie-less matters: a cookie-authenticated
 * POST without an Origin header is rejected by the CSRF guard, and the response only carries the
 * access token when the request does not come from the web origin.
 */
async function authCall(path: "login" | "register", data: Record<string, string>) {
  const context = await apiRequest.newContext();
  try {
    const response = await context.post(`${apiUrl}/auth/${path}`, { data });
    expect(response.ok()).toBe(true);
    return (await response.json()) as Session;
  } finally {
    await context.dispose();
  }
}

async function registerUser(purpose: string, name: string) {
  return authCall("register", { email: uniqueEmail(purpose), password: "password123", name });
}

/** Adds the API session cookies to the browser context so server components and fetches see the session. */
async function signInAs(page: Page, token: string) {
  await page.context().addCookies([
    { name: "agentops_access", value: token, url: webUrl, httpOnly: true, sameSite: "Lax" },
    { name: "agentops_session", value: "1", url: webUrl, sameSite: "Lax" }
  ]);
}

function adminSession() {
  if (!admin) {
    throw new Error("Admin session was not created");
  }
  return admin;
}

test.beforeAll(async () => {
  admin = await authCall("login", { email: "operator@agentops.local", password: "password123" });
  nonAdmin = await registerUser("admin-target", "E2E Regular User");
});

test("TC-ADM-01 a platform admin sees the overview KPIs and charts and can switch the range", async ({ page }) => {
  await signInAs(page, adminSession().accessToken);
  await page.goto("/admin?lang=en");

  await expect(page.getByRole("heading", { name: "Platform admin" })).toBeVisible();
  await expect(page.getByText("Active users 7d", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending approvals", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runs per day" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Signups per day" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI tokens per day" })).toBeVisible();
  await expect(page.locator("aside").getByRole("link", { name: "Admin", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "7 days", exact: true }).click();
  await expect(page).toHaveURL(/[?&]days=7\b/);
  await expect(page.getByRole("link", { name: "7 days", exact: true })).toHaveAttribute("aria-current", "true");

  await page.getByRole("link", { name: "30 days", exact: true }).click();
  await expect(page).toHaveURL(/[?&]days=30\b/);
  await expect(page.getByRole("heading", { name: "Runs per day" })).toBeVisible();
});

test("TC-ADM-02 the users CSV report downloads with the expected header row", async ({ page }) => {
  await signInAs(page, adminSession().accessToken);
  await page.goto("/admin?lang=en");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('a[data-report="users"]').click()
  ]);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const csv = await readFile(filePath as string, "utf8");
  const firstLine = csv.replace(/^\uFEFF/, "").split(/\r?\n/)[0];
  expect(firstLine).toBe("id,email,name,provider,platform_admin,status,workspaces,created_at,last_login_at");
});

test("TC-ADM-03 an admin disables a fresh account in the UI and enables it again", async ({ page, request }) => {
  test.setTimeout(120_000);
  const target = await registerUser("admin-disable", "E2E Disable Target");
  await signInAs(page, adminSession().accessToken);

  await page.goto("/admin?lang=en&tab=accounts");
  await page.getByPlaceholder("Search by name or email").fill(target.user.email);
  const row = page.locator("tbody tr", { hasText: target.user.email });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Lock", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Confirm change" });
  await expect(confirm).toContainText(target.user.email);
  const [disableResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes(`/admin/users/${target.user.id}`) && response.request().method() === "PATCH"
    ),
    confirm.getByRole("button", { name: "Confirm", exact: true }).click()
  ]);
  expect(disableResponse.ok()).toBe(true);
  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();

  const disabledLogin = await request.post(`${apiUrl}/auth/login`, {
    data: { email: target.user.email, password: "password123" }
  });
  expect(disabledLogin.status()).toBe(403);

  await row.getByRole("button", { name: "Unlock", exact: true }).click();
  const reConfirm = page.getByRole("dialog", { name: "Confirm change" });
  const [enableResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes(`/admin/users/${target.user.id}`) && response.request().method() === "PATCH"
    ),
    reConfirm.getByRole("button", { name: "Confirm", exact: true }).click()
  ]);
  expect(enableResponse.ok()).toBe(true);
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  const enabledLogin = await request.post(`${apiUrl}/auth/login`, {
    data: { email: target.user.email, password: "password123" }
  });
  expect(enabledLogin.ok()).toBe(true);
});

test("TC-ADM-04 granting and revoking platform admin writes audit rows", async ({ page }) => {
  test.setTimeout(120_000);
  const target = nonAdmin as Session;
  await signInAs(page, adminSession().accessToken);

  await page.goto("/admin?lang=en&tab=accounts");
  await page.getByPlaceholder("Search by name or email").fill(target.user.email);
  const row = page.locator("tbody tr", { hasText: target.user.email });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Grant admin", exact: true }).click();
  const grantDialog = page.getByRole("dialog", { name: "Confirm change" });
  const [grantResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes(`/admin/users/${target.user.id}`) && response.request().method() === "PATCH"
    ),
    grantDialog.getByRole("button", { name: "Confirm", exact: true }).click()
  ]);
  expect(grantResponse.ok()).toBe(true);
  await expect(row.getByText("Admin", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Revoke admin", exact: true }).click();
  const revokeDialog = page.getByRole("dialog", { name: "Confirm change" });
  const [revokeResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes(`/admin/users/${target.user.id}`) && response.request().method() === "PATCH"
    ),
    revokeDialog.getByRole("button", { name: "Confirm", exact: true }).click()
  ]);
  expect(revokeResponse.ok()).toBe(true);
  await expect(row.getByText("Admin", { exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Grant admin", exact: true })).toBeVisible();

  await page.goto("/admin?lang=en&tab=audit");
  await page.getByPlaceholder("Filter by action name").fill("admin.user.admin_");
  await expect(page.getByText("admin.user.admin_granted", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("admin.user.admin_revoked", { exact: true }).first()).toBeVisible();
});

test("TC-ADM-05 a non-admin sees no-permission, no admin nav item and gets 403 from the admin API", async ({ page, request }) => {
  const user = nonAdmin as Session;
  await signInAs(page, user.accessToken);
  await page.goto("/admin?lang=en");

  await expect(page.getByRole("heading", { name: "Platform admin" })).toBeVisible();
  await expect(page.getByText("No permission", { exact: true })).toBeVisible();
  await expect(page.getByText("You need platform administrator rights to open this area.", { exact: true })).toBeVisible();
  await expect(page.locator("aside").getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

  const response = await request.get(`${apiUrl}/admin/overview`, {
    headers: { authorization: `Bearer ${user.accessToken}` }
  });
  expect(response.status()).toBe(403);
});
