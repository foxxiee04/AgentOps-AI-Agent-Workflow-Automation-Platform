import { expect, request as apiRequest, test } from "@playwright/test";

/**
 * TC-SEC: API-only authorization and CSRF checks against the local stack.
 * The operator platform admin session is created once per file because auth endpoints are rate limited.
 */
const webOrigin = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type AuthUser = { id: string; email: string; name: string };
type Session = { user: AuthUser; accessToken: string };
type Cookie = { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: "Strict" | "Lax" | "None" };

let admin: Session | undefined;
let adminCookies: Cookie[] = [];

function uniqueEmail(purpose: string) {
  return `e2e-${purpose}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
}

/** A fresh cookie-less context avoids the CSRF guard rejecting cookie-authenticated auth calls. */
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

function adminSession() {
  if (!admin) {
    throw new Error("Admin session was not created");
  }
  return admin;
}

test.beforeAll(async () => {
  const context = await apiRequest.newContext();
  try {
    const response = await context.post(`${apiUrl}/auth/login`, {
      data: { email: "operator@agentops.local", password: "password123" }
    });
    expect(response.ok()).toBe(true);
    admin = (await response.json()) as Session;
    adminCookies = (await context.storageState()).cookies as Cookie[];
  } finally {
    await context.dispose();
  }
});

test("TC-SEC-01 protected endpoints answer 401 without a session", async ({ request }) => {
  const endpoints = ["/auth/me", "/dashboard/overview?workspaceId=ws_demo", "/admin/overview"];
  for (const endpoint of endpoints) {
    const response = await request.get(`${apiUrl}${endpoint}`);
    expect(response.status(), endpoint).toBe(401);
  }
});

test("TC-SEC-02 cookie-authenticated writes need the web Origin", async () => {
  // Reuse the operator login response cookies: the CSRF guard only looks at the session cookie.
  const context = await apiRequest.newContext({ storageState: { cookies: adminCookies, origins: [] } });
  try {
    const blocked = await context.post(`${apiUrl}/auth/logout`, { data: {} });
    expect(blocked.status()).toBe(403);
    expect(JSON.stringify(await blocked.json())).toContain("Cross-site request blocked");

    const allowed = await context.post(`${apiUrl}/auth/logout`, {
      data: {},
      headers: { origin: webOrigin }
    });
    expect(allowed.ok()).toBe(true);
  } finally {
    await context.dispose();
  }
});

test("TC-SEC-03 disabling an account revokes its existing access token immediately", async ({ request }) => {
  const target = await authCall("register", {
    email: uniqueEmail("security-disabled"),
    password: "password123",
    name: "E2E Disabled Token"
  });

  async function patchTarget(disabled: boolean) {
    return request.patch(`${apiUrl}/admin/users/${target.user.id}`, {
      headers: { authorization: `Bearer ${adminSession().accessToken}` },
      data: { disabled }
    });
  }

  const disable = await patchTarget(true);
  expect(disable.ok()).toBe(true);

  try {
    const blocked = await request.get(`${apiUrl}/auth/me`, {
      headers: { authorization: `Bearer ${target.accessToken}` }
    });
    expect(blocked.status()).toBe(403);
  } finally {
    const enable = await patchTarget(false);
    expect(enable.ok()).toBe(true);
  }

  const restored = await request.get(`${apiUrl}/auth/me`, {
    headers: { authorization: `Bearer ${target.accessToken}` }
  });
  expect(restored.ok()).toBe(true);
});

test("TC-SEC-04 an admin cannot disable their own account", async ({ request }) => {
  const admin = adminSession();
  const response = await request.patch(`${apiUrl}/admin/users/${admin.user.id}`, {
    headers: { authorization: `Bearer ${admin.accessToken}` },
    data: { disabled: true }
  });
  expect(response.status()).toBe(400);
});
