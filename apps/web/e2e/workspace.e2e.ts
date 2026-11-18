import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * TC-WS: workspace isolation for an account created through the registration form.
 * The tests share the user created in TC-WS-01, so they run serially in order.
 */
const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type Workspace = { id: string; name: string; slug: string; role: string };
type Me = { id: string; email: string; isPlatformAdmin: boolean; workspaces: Workspace[] };

type RegisteredUser = {
  name: string;
  email: string;
  password: string;
  token: string;
  workspace: Workspace;
};

let registered: RegisteredUser | undefined;

function user() {
  if (!registered) {
    throw new Error("The registration test did not complete");
  }
  return registered;
}

function uniqueEmail(purpose: string) {
  return `e2e-${purpose}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
}

async function accessTokenFrom(page: Page) {
  const cookies = await page.context().cookies();
  const access = cookies.find((cookie) => cookie.name === "agentops_access");
  expect(access).toBeTruthy();
  return (access as { value: string }).value;
}

async function me(request: APIRequestContext, token: string) {
  const response = await request.get(`${apiUrl}/auth/me`, {
    headers: { authorization: `Bearer ${token}` }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Me;
}

test.describe.serial("workspace isolation", () => {
  test("TC-WS-01 registering in the UI lands in a personal workspace with an empty dashboard", async ({ page }) => {
    test.setTimeout(90_000);
    const name = "E2E Workspace Owner";
    const email = uniqueEmail("workspace-owner");
    const password = "password123";

    await page.goto("/register?lang=en");
    await expect(page.getByRole("heading", { name: "Register for AgentOps" })).toBeVisible();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);

    const [registerResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/auth/register") && response.request().method() === "POST"),
      page.getByRole("button", { name: "Register", exact: true }).click()
    ]);
    expect(registerResponse.ok()).toBe(true);

    await expect(page).toHaveURL(/\/dashboard\?lang=en$/);
    await expect(page.getByRole("heading", { name: "Workflow operations" })).toBeVisible();

    const token = await accessTokenFrom(page);
    const session = await me(page.request, token);
    expect(session.workspaces).toHaveLength(1);
    expect(session.workspaces[0].role).toBe("OWNER");
    expect(session.workspaces[0].id).not.toBe("ws_demo");

    const workspace = session.workspaces[0];
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText(workspace.name, { exact: true })).toBeVisible();
    await expect(sidebar.getByText("OWNER", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("AgentOps Demo", { exact: true })).toHaveCount(0);

    await expect(page.getByText("No leads scored yet. Send a lead through the webhook or the Run button.")).toBeVisible();
    await expect(page.getByText("No workflow runs yet. Run the lead qualification workflow from the workflows page.")).toBeVisible();
    await expect(page.getByText("No tasks yet. A task is created after a hot lead's email is approved and sent.")).toBeVisible();
    await expect(page.getByText("Call lead back within 24 hours")).toHaveCount(0);

    registered = { name, email, password, token, workspace };
  });

  test("TC-WS-02 the new user cannot read the demo workspace and needs a workspace id", async ({ request }) => {
    const token = user().token;

    const demo = await request.get(`${apiUrl}/dashboard/overview?workspaceId=ws_demo`, {
      headers: { authorization: `Bearer ${token}` }
    });
    expect(demo.status()).toBe(403);

    const missing = await request.get(`${apiUrl}/dashboard/overview`, {
      headers: { authorization: `Bearer ${token}` }
    });
    expect(missing.status()).toBe(400);
  });

  test("TC-WS-03 /auth/me lists the user's workspace with the OWNER role", async ({ request }) => {
    const session = await me(request, user().token);

    expect(session.email).toBe(user().email);
    expect(session.isPlatformAdmin).toBe(false);
    expect(session.workspaces).toHaveLength(1);
    expect(session.workspaces[0]).toMatchObject({ id: user().workspace.id, role: "OWNER" });
  });
});
