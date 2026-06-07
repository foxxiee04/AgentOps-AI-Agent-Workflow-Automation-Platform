import { expect, test } from "@playwright/test";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

test("user can exercise the main AgentOps workflow through the UI", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nền tảng tự động hóa workflow bằng AI Agent" })).toBeVisible();
  await page.goto("/vi");
  await expect(page.getByRole("heading", { name: "Nền tảng tự động hóa workflow bằng AI Agent" })).toBeVisible();
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "AI Agent workflow automation platform" })).toBeVisible();

  await page.getByRole("link", { name: "Open dashboard" }).first().click();
  await expect(page).toHaveURL(/\/login\?lang=en&next=/);
  await expect(page.getByRole("heading", { name: "Log in to AgentOps" })).toBeVisible();
  await page.getByLabel("Email").fill("operator@agentops.local");
  await page.getByLabel("Password").fill("password123");
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/auth/login") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Log in" }).click()
  ]);
  expect(loginResponse.ok()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard\?lang=en$/);
  await expect(page.getByRole("heading", { name: "Workflow operations" })).toBeVisible();
  await expect(page.getByText("Signed in: operator")).toBeVisible();
  await expect(page.getByText("[+] Dependency readiness")).toBeVisible();
  await expect(page.getByText("postgres", { exact: true })).toBeVisible();
  await expect(page.getByText("kafka", { exact: true })).toBeVisible();

  await page.locator("aside").getByRole("link", { name: /Workflows/ }).click();
  await expect(page).toHaveURL(/\/workflows\?lang=en$/);
  await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
  await expect(page.getByText("Lead qualification")).toBeVisible();

  const [publishResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/workflows/wf_lead_qualification/publish") && response.request().method() === "POST"
    ),
    page.getByRole("button", { name: /^Publish$/ }).click()
  ]);
  expect(publishResponse.ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Published" })).toBeVisible();

  const [runResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("/workflows/wf_lead_qualification/run") && response.request().method() === "POST"
    ),
    page.getByRole("button", { name: /^Run$/ }).click()
  ]);
  expect(runResponse.ok()).toBe(true);
  const runPayload = (await runResponse.json()) as { run: { id: string } };
  expect(runPayload.run.id).toMatch(/^run_/);

  const stepsResponse = await request.get(`${apiUrl}/workflow-runs/${runPayload.run.id}/steps`);
  expect(stepsResponse.ok()).toBe(true);
  const stepsPayload = (await stepsResponse.json()) as { steps: Array<{ status: string }> };
  expect(stepsPayload.steps).toHaveLength(5);
  expect(stepsPayload.steps[0]?.status).toBe("COMPLETED");

  await page.goto(`/runs/${runPayload.run.id}?lang=en`);
  await expect(page.getByRole("heading", { name: "Run timeline" })).toBeVisible();
  await expect(page.getByText(runPayload.run.id)).toBeVisible();
  await expect(page.getByText("Manual lead trigger")).toBeVisible();
  await expect(page.getByText("Trigger accepted by API and workflow event published.")).toBeVisible();

  await page.getByRole("link", { name: "Builder" }).first().click();
  await expect(page).toHaveURL(/\/workflows\/wf_lead_qualification\/builder\?lang=en$/);
  await expect(page.getByText("Valid graph")).toBeVisible();
  await expect(page.getByText("Manual lead trigger")).toBeVisible();
  await page.getByText("Score lead").click();
  await expect(page.getByText("Node config")).toBeVisible();
  await expect(page.getByText("outputSchema")).toBeVisible();

  await page.locator("aside").getByRole("link", { name: /Agents/ }).click();
  await expect(page).toHaveURL(/\/agents\?lang=en$/);
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
  await page.locator("#ai-input").fill(
    JSON.stringify(
      {
        leadName: "UI Smoke Lead",
        message: "urgent sales automation and support routing"
      },
      null,
      2
    )
  );
  const [aiResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/ai/test-agent") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Test agent" }).click()
  ]);
  expect(aiResponse.ok()).toBe(true);
  const aiPayload = (await aiResponse.json()) as { validation: { schemaValid: boolean } };
  expect(aiPayload.validation.schemaValid).toBe(true);
  await expect(page.getByText("high-intent")).toBeVisible();

  await page.locator("aside").getByRole("link", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings\?lang=en$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("API boundary")).toBeVisible();
  await expect(page.getByText("postgres", { exact: true })).toBeVisible();
  await expect(page.getByText("kafka", { exact: true })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
