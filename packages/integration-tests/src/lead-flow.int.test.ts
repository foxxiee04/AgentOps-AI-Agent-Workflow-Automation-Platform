import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Kafka, logLevel, type Consumer } from "kafkajs";
import { createPrismaClient, type PrismaClient } from "@agentops/database";
import { integrationDatabaseUrl, integrationEnv } from "./env";

type Stoppable = { stop(): Promise<void>; consumer: Consumer };

const suffix = `it-${Date.now()}`;
const failMarker = "PROVIDER_OUTAGE_SIMULATION";

let prisma: PrismaClient;
let apiUrl: string;
let accessToken: string;
let closeApi: () => Promise<void>;
const workers: Stoppable[] = [];

beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: integrationDatabaseUrl(),
    KAFKA_BROKERS: integrationEnv.kafkaBrokers,
    NODE_ENV: "test",
    APP_ENV: "integration",
    DEMO_LOGIN_ENABLED: "true",
    WORKFLOW_AUTO_APPROVE: "false",
    OTEL_ENABLED: "false",
    JWT_ACCESS_SECRET: "integration-access-secret",
    JWT_REFRESH_SECRET: "integration-refresh-secret"
  });
  prisma = createPrismaClient(integrationDatabaseUrl());

  // Workers run in-process with their own consumer groups so a developer's local workers are not disturbed.
  const kafka = new Kafka({ clientId: `agentops-${suffix}`, brokers: integrationEnv.kafkaBrokers.split(","), logLevel: logLevel.ERROR });
  const { startWorkflowWorker } = await import("../../../apps/workflow-worker/src/main");
  const { startAiWorker } = await import("../../../apps/ai-worker/src/main");
  const { createProvider } = await import("../../../apps/ai-worker/src/ai-task.executor");
  const { startToolWorker } = await import("../../../apps/tool-worker/src/main");
  const { startNotificationWorker } = await import("../../../apps/notification-worker/src/main");

  workers.push(await startWorkflowWorker({ kafka, groupId: `agentops.workflow-worker.${suffix}`, autoApprove: false }));
  workers.push(
    await startAiWorker({
      kafka,
      groupId: `agentops.ai-worker.${suffix}`,
      // Mock provider, except for leads carrying the marker: those simulate a provider outage.
      providerFactory: (provider) => {
        const real = createProvider(provider);
        return {
          complete: async (request) => {
            if (request.prompt.user.includes(failMarker)) {
              throw new Error("simulated provider outage");
            }
            return real.complete(request);
          }
        };
      }
    })
  );
  workers.push(await startToolWorker({ kafka, groupId: `agentops.tool-worker.${suffix}` }));
  workers.push(await startNotificationWorker({ kafka, groupId: `agentops.notification-worker.${suffix}` }));
  await Promise.all(workers.map((worker) => waitUntil(async () => (await worker.consumer.describeGroup()).state === "Stable", 60_000)));

  const { createApp } = await import("../../../apps/api/src/bootstrap");
  const app = await createApp({ swagger: false, logger: false });
  await app.listen(0, "127.0.0.1");
  apiUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  closeApi = () => app.close();

  const login = await api("POST", "/auth/login", { email: `reviewer-${suffix}@agentops.local`, password: "integration-pass-123" });
  expect(login.status).toBe(201);
  accessToken = login.body.accessToken;

  // A run never publishes on the caller's behalf, so the workflow under test is published once here.
  const published = await api("POST", "/workflows/wf_lead_qualification/publish");
  expect(published.status).toBe(201);
  expect(published.body.workflow.status).toBe("ACTIVE");
});

afterAll(async () => {
  await closeApi?.();
  await Promise.all(workers.map((worker) => worker.stop()));
  await prisma?.$disconnect();
});

describe("lead flow on real PostgreSQL + Kafka", () => {
  it("hot lead: scores, branches, waits for approval, sends mock email, creates the sales task", async () => {
    const runId = await triggerLead("Chúng tôi cần tự động hóa việc trả lời khách hàng qua chat và theo dõi đơn hàng.");

    const approval = await waitFor(() => prisma.humanApproval.findUnique({ where: { workflowRunId_nodeId: { workflowRunId: runId, nodeId: "approval-1" } } }));
    expect(approval.status).toBe("WAITING_APPROVAL");
    expect(approval.payloadJson).toMatchObject({ lead: { email: "an***@shopabc.vn" }, assessment: { leadScore: 87 } });
    expect((await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } })).status).toBe("WAITING_APPROVAL");

    const pending = await api("GET", `/workflow-runs/approvals?workspaceId=ws_demo`);
    expect(pending.body.map((item: { workflowRunId: string }) => item.workflowRunId)).toContain(runId);

    const decided = await api("POST", `/workflow-runs/${runId}/steps/${runId}_approval-1/approval`, { decision: "approve", comment: "looks good" });
    expect(decided.status).toBe(200);
    expect(decided.body.approval.status).toBe("APPROVED");

    const again = await api("POST", `/workflow-runs/${runId}/steps/${runId}_approval-1/approval`, { decision: "reject", comment: "too late" });
    expect(again.status).toBe(409);
    expect(again.body.details.status).toBe("APPROVED");

    const run = await waitFor(async () => {
      const current = await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      return current.status === "COMPLETED" ? current : undefined;
    });
    expect(run.finishedAt).not.toBeNull();

    const steps = await prisma.workflowStepRun.findMany({ where: { workflowRunId: runId } });
    const status = Object.fromEntries(steps.map((step) => [step.nodeId, step.status]));
    expect(status).toMatchObject({
      "trigger-1": "COMPLETED",
      "ai-1": "COMPLETED",
      "condition-1": "COMPLETED",
      "ai-2": "COMPLETED",
      "approval-1": "COMPLETED",
      "email-1": "COMPLETED",
      "notify-1": "COMPLETED",
      "end-1": "COMPLETED"
    });
    const scoringStep = steps.find((step) => step.nodeId === "ai-1");
    expect(JSON.stringify(scoringStep?.inputJson)).not.toContain("anna@shopabc.vn");

    expect(await prisma.aiTaskResult.count({ where: { workflowRunId: runId } })).toBe(2);
    expect(await prisma.toolCallResult.count({ where: { workflowRunId: runId } })).toBe(1);
    expect(await prisma.usageRecord.count({ where: { workflowRunId: runId } })).toBe(2);
    const task = await waitFor(() => findSalesTask(runId));
    expect(task.title).toBe("Call lead back within 24 hours");
    expect(task.metadataJson).toMatchObject({ workflowRunId: runId, nodeId: "notify-1", dueAt: expect.any(String) });

    // Redelivering the approval event must not send a second email or create a second task.
    const decidedEvent = await prisma.domainEvent.findFirstOrThrow({ where: { workflowRunId: runId, type: "human-approval-decided" } });
    const producer = new Kafka({ clientId: `agentops-${suffix}-redeliver`, brokers: integrationEnv.kafkaBrokers.split(",") }).producer();
    await producer.connect();
    await producer.send({
      topic: "human-approval-decided",
      messages: [{ key: runId, value: JSON.stringify({ ...envelopeFrom(decidedEvent), eventId: `evt_${randomUUID()}` }) }]
    });
    await producer.disconnect();
    await sleep(4_000);
    expect(await prisma.toolCallResult.count({ where: { workflowRunId: runId } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: "SALES_TASK", metadataJson: { path: ["workflowRunId"], equals: runId } } })).toBe(1);
  });

  it("low-intent lead: completes after scoring and skips the email branch", async () => {
    const runId = await triggerLead("Just looking around, curious what the product does.");

    const run = await waitFor(async () => {
      const current = await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      return current.status === "COMPLETED" ? current : undefined;
    });
    expect(run.status).toBe("COMPLETED");
    const steps = await prisma.workflowStepRun.findMany({ where: { workflowRunId: runId } });
    const status = Object.fromEntries(steps.map((step) => [step.nodeId, step.status]));
    expect(status).toMatchObject({ "ai-1": "COMPLETED", "condition-1": "COMPLETED", "ai-2": "SKIPPED", "email-1": "SKIPPED", "end-1": "COMPLETED" });
    expect(await prisma.humanApproval.count({ where: { workflowRunId: runId } })).toBe(0);
  });

  it("rejected email: skips the email, still creates the sales task with the reason", async () => {
    const runId = await triggerLead("We need automation for order tracking via chat, urgent.");
    await waitFor(() => prisma.humanApproval.findUnique({ where: { workflowRunId_nodeId: { workflowRunId: runId, nodeId: "approval-1" } } }));

    // A rejection needs a reason: at least 3 non-space characters.
    const withoutComment = await api("POST", `/workflow-runs/${runId}/steps/approval-1/approval`, { decision: "reject" });
    expect(withoutComment.status).toBe(400);
    const stillPending = await prisma.humanApproval.findUniqueOrThrow({
      where: { workflowRunId_nodeId: { workflowRunId: runId, nodeId: "approval-1" } }
    });
    expect(stillPending.status).toBe("WAITING_APPROVAL");

    const rejected = await api("POST", `/workflow-runs/${runId}/steps/approval-1/approval`, { decision: "reject", comment: "wrong tone" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.approval.status).toBe("REJECTED");

    // The lead stays hot: the run continues through the `rejected` edge instead of being cancelled.
    const run = await waitFor(async () => {
      const current = await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      return current.status === "COMPLETED" ? current : undefined;
    });
    expect(run.status).toBe("COMPLETED");

    const steps = await prisma.workflowStepRun.findMany({ where: { workflowRunId: runId } });
    const status = Object.fromEntries(steps.map((step) => [step.nodeId, step.status]));
    expect(status).toMatchObject({
      "approval-1": "COMPLETED",
      "email-1": "SKIPPED",
      "notify-1": "COMPLETED",
      "end-1": "COMPLETED"
    });

    // The email was skipped, so it was never sent.
    expect(await prisma.toolCallResult.count({ where: { workflowRunId: runId } })).toBe(0);
    expect(await prisma.toolCallResult.count({ where: { workflowRunId: runId, nodeId: "email-1" } })).toBe(0);

    // The sales task is still created and states why the email was rejected.
    const task = await waitFor(() => findSalesTask(runId));
    expect(task.title).toBe("Call lead back within 24 hours");
    expect(task.body).toMatch(/^Email rejected by reviewer: wrong tone\./);
    expect(task.metadataJson).toMatchObject({ workflowRunId: runId, nodeId: "notify-1", dueAt: expect.any(String) });
  });

  it("provider outage: retries 3 times, dead-letters the task and fails the run", async () => {
    const runId = await triggerLead(`We need chat automation. ${failMarker}`);

    const run = await waitFor(async () => {
      const current = await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      return current.status === "FAILED" ? current : undefined;
    });
    expect(run.errorMessage).toContain("simulated provider outage");
    const processed = await prisma.processedMessage.findFirstOrThrow({
      where: { consumerGroup: `agentops.ai-worker.${suffix}`, idempotencyKey: `${runId}:ai-1:agent-task-requested` }
    });
    expect(processed.outcome).toBe("dead_lettered");
    const step = await prisma.workflowStepRun.findUniqueOrThrow({ where: { workflowRunId_nodeId: { workflowRunId: runId, nodeId: "ai-1" } } });
    expect(step.status).toBe("FAILED");
  });

  it("rejects approval decisions without a token or from a viewer", async () => {
    const noToken = await fetch(`${apiUrl}/workflow-runs/run_missing/steps/approval-1/approval`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" })
    });
    expect(noToken.status).toBe(401);

    const viewerEmail = `viewer-${suffix}@agentops.local`;
    const viewer = await api("POST", "/auth/login", { email: viewerEmail, password: "integration-pass-123" });
    await prisma.workspaceMember.updateMany({ where: { workspaceId: "ws_demo", user: { email: viewerEmail } }, data: { role: "VIEWER" } });
    const runId = await triggerLead("We need chat automation for orders.");
    await waitFor(() => prisma.humanApproval.findUnique({ where: { workflowRunId_nodeId: { workflowRunId: runId, nodeId: "approval-1" } } }));

    const forbidden = await fetch(`${apiUrl}/workflow-runs/${runId}/steps/approval-1/approval`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${viewer.body.accessToken}` },
      body: JSON.stringify({ decision: "approve" })
    });
    expect(forbidden.status).toBe(403);
  });

  it("browser session: HttpOnly cookies, cookie auth and origin-checked writes", async () => {
    const webOrigin = "http://localhost:3000";
    const email = `browser-${suffix}@agentops.local`;

    const login = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: webOrigin },
      body: JSON.stringify({ email, password: "integration-pass-123" })
    });
    expect(login.status).toBe(201);
    const loginBody = (await login.json()) as { user: { email: string }; accessToken?: string; refreshToken?: string };
    expect(loginBody.user.email).toBe(email);
    expect(loginBody.accessToken).toBeUndefined();
    expect(loginBody.refreshToken).toBeUndefined();

    const setCookies = login.headers.getSetCookie();
    const accessCookie = setCookies.find((cookie) => cookie.startsWith("agentops_access="));
    const refreshCookie = setCookies.find((cookie) => cookie.startsWith("agentops_refresh="));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    // Only the token cookies are HttpOnly.
    for (const cookie of [accessCookie, refreshCookie]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    }
    expect(refreshCookie).toMatch(/Path=\/auth/i);

    // The session hint carries no secret: the web app reads it, so it is not HttpOnly.
    const sessionHint = setCookies.find((cookie) => cookie.startsWith("agentops_session="));
    expect(sessionHint).toBeDefined();
    expect(sessionHint).toMatch(/^agentops_session=1(;|$)/);
    expect(sessionHint).not.toMatch(/HttpOnly/i);
    expect(sessionHint).toMatch(/Path=\/(;|$)/);
    expect(sessionHint).toMatch(/SameSite=Lax/i);

    let cookie = setCookies.map((entry) => entry.split(";")[0]).join("; ");

    const me = await fetch(`${apiUrl}/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { email: string };
    expect(meBody.email).toBe(email);

    const blockedRun = await fetch(`${apiUrl}/workflows/wf_lead_qualification/run`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({
        triggerType: "webhook",
        input: { name: "Anna Nguyen", company: "Shop ABC", email: "anna@shopabc.vn", message: "Need chat automation.", source: "website_form" }
      })
    });
    expect(blockedRun.status).toBe(403);

    const blockedRefresh = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    expect(blockedRefresh.status).toBe(403);

    const refreshed = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { cookie, origin: webOrigin, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    expect(refreshed.status).toBe(201);
    const refreshedBody = (await refreshed.json()) as { accessToken?: string };
    expect(refreshedBody.accessToken).toBeUndefined();
    const refreshedCookies = refreshed.headers.getSetCookie();
    expect(refreshedCookies.some((entry) => entry.startsWith("agentops_access="))).toBe(true);
    expect(refreshedCookies.some((entry) => entry.startsWith("agentops_refresh="))).toBe(true);
    cookie = refreshedCookies.map((entry) => entry.split(";")[0]).join("; ");

    const logout = await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      headers: { cookie, origin: webOrigin, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    expect(logout.status).toBe(201);
    const cleared = logout.headers.getSetCookie();
    expect(cleared.some((entry) => entry.startsWith("agentops_access="))).toBe(true);
    expect(cleared.some((entry) => entry.startsWith("agentops_refresh="))).toBe(true);
    for (const entry of cleared) {
      expect(entry).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    }

    const revoked = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { cookie, origin: webOrigin, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    expect(revoked.status).toBe(401);
  });
});

async function triggerLead(message: string): Promise<string> {
  const response = await api("POST", "/workflows/wf_lead_qualification/run", {
    triggerType: "webhook",
    input: { name: "Anna Nguyen", company: "Shop ABC", email: "anna@shopabc.vn", message, source: "website_form" }
  });
  expect(response.status).toBe(201);
  return response.body.run.id as string;
}

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

function findSalesTask(runId: string) {
  return prisma.notification.findFirst({ where: { type: "SALES_TASK", metadataJson: { path: ["workflowRunId"], equals: runId } } });
}

function envelopeFrom(event: { id: string; type: string; workspaceId: string; workflowId: string | null; workflowRunId: string; payloadJson: unknown; createdAt: Date }) {
  return {
    eventId: event.id,
    type: event.type,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId ?? undefined,
    workflowRunId: event.workflowRunId,
    timestamp: event.createdAt.toISOString(),
    payload: event.payloadJson
  };
}

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) {
      return value;
    }
    await sleep(250);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function waitUntil(probe: () => Promise<boolean>, timeoutMs: number) {
  await waitFor(async () => ((await probe()) ? true : undefined), timeoutMs);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
