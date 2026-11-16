import { expect, test } from "@playwright/test";

/**
 * Main lead flow through the UI against the real local stack (API + 4 workers + Postgres + Kafka):
 * log in -> create a workflow from the lead template -> publish -> run -> approve the email -> run completes
 * and a sales task appears. Requires WORKFLOW_AUTO_APPROVE=false (the default).
 */
test("lead flow: login, create, publish, run, approve, task created", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "AI Agent workflow automation platform" })).toBeVisible();

  // 1. Log in (local @agentops.local accounts are created on first login).
  await page.goto("/login?lang=en");
  await expect(page.getByRole("heading", { name: "Log in to AgentOps" })).toBeVisible();
  await page.getByLabel("Email").fill(`e2e-${Date.now()}@agentops.local`);
  await page.getByLabel("Password").fill("password123");
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/auth/login") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Log in" }).click()
  ]);
  expect(loginResponse.ok()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard\?lang=en$/);
  await expect(page.getByRole("heading", { name: "Workflow operations" })).toBeVisible();

  // 2. Create a workflow from the lead template; it opens in the builder.
  await page.locator("aside").getByRole("link", { name: /Workflows/ }).click();
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  const [createResponse] = await Promise.all([
    page.waitForResponse((response) => /\/workflows$/.test(response.url()) && response.request().method() === "POST"),
    page.getByRole("button", { name: "Create from lead template" }).click()
  ]);
  expect(createResponse.ok()).toBe(true);
  const { id: workflowId } = (await createResponse.json()) as { id: string };
  await expect(page).toHaveURL(new RegExp(`/workflows/${workflowId}/builder`));
  await expect(page.getByText("Valid graph")).toBeVisible();
  await expect(page.getByText("leadScore > 80")).toBeVisible();
  await expect(page.getByText("Review email")).toBeVisible();

  // 3. Publish.
  const [publishResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/workflows/${workflowId}/publish`) && response.request().method() === "POST"),
    page.getByRole("button", { name: /^Publish$/ }).click()
  ]);
  expect(publishResponse.ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Published" })).toBeVisible();

  // 4. Run with the sample hot lead and open the run.
  const [runResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/workflows/${workflowId}/run`) && response.request().method() === "POST"),
    page.getByRole("button", { name: /^Run$/ }).click()
  ]);
  expect(runResponse.ok()).toBe(true);
  const { run } = (await runResponse.json()) as { run: { id: string } };
  await page.goto(`/runs/${run.id}?lang=en`);
  await expect(page.getByRole("heading", { name: "Run timeline" })).toBeVisible();

  // The page polls: scoring -> branch A -> email draft -> waiting for approval.
  await expect(page.getByText("This run is waiting for an email approval.")).toBeVisible({ timeout: 60_000 });
  // The input panel shows the trigger input with PII masked.
  await expect(page.locator("main aside pre")).toContainText("an***@shopabc.vn");
  await expect(page.getByText("anna@shopabc.vn")).toHaveCount(0);

  // 5. Approve the drafted email.
  await page.getByRole("link", { name: "Open approvals" }).click();
  await expect(page.getByRole("heading", { name: "Emails waiting for approval" })).toBeVisible();
  const card = page.locator("article", { hasText: run.id });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText("high-intent")).toBeVisible();
  await card.getByLabel("Reason / note").fill("Looks good");
  const [decisionResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/workflow-runs/${run.id}/steps/`) && response.request().method() === "POST"),
    card.getByRole("button", { name: "Approve and send" }).click()
  ]);
  expect(decisionResponse.status()).toBe(200);
  // The decided card leaves the queue; its outcome stays in the "Just decided" block with a link to the run.
  await expect(page.getByText("Approved and email sent").first()).toBeVisible();
  await expect(card).toHaveCount(0);

  // 6. The run finishes and the sales task shows on the dashboard.
  await page.goto(`/runs/${run.id}?lang=en`);
  await expect(page.getByText("✓ Run finished")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-step='notify-1']").getByText("COMPLETED", { exact: true })).toBeVisible();

  await page.goto("/dashboard?lang=en");
  await expect(page.getByText("Sales tasks")).toBeVisible();
  await expect(page.getByText("Call lead back within 24 hours").first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});
