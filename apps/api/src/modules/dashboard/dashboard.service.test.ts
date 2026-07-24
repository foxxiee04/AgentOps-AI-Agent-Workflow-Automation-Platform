import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardService, type ReadinessStatus } from "./dashboard.service";

describe("DashboardService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("surfaces concrete next actions when the demo is not fully configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_ACCESS_SECRET", "replace-me");
    vi.stubEnv("JWT_REFRESH_SECRET", "replace-me");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OTEL_ENABLED", "false");

    const service = createService();
    const readiness = await service.readiness();

    expect(statusFor(readiness.items, "workflow-publishing")).toBe("warning");
    expect(statusFor(readiness.items, "ai-provider")).toBe("warning");
    expect(statusFor(readiness.items, "observability")).toBe("warning");
    expect(statusFor(readiness.items, "production-secrets")).toBe("warning");
    expect(readiness.nextActions).toContain("Publish the lead qualification workflow and run it once from the Workflows screen.");
  });

  it("marks workflow, event, AI provider, and secrets as ready when configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_ACCESS_SECRET", "local-access-secret-for-tests");
    vi.stubEnv("JWT_REFRESH_SECRET", "local-refresh-secret-for-tests");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OTEL_ENABLED", "true");

    const service = createService({ activeWorkflow: true, recentEvents: [{ eventId: "evt_test" }] });
    const readiness = await service.readiness();

    expect(statusFor(readiness.items, "workflow-publishing")).toBe("ready");
    expect(statusFor(readiness.items, "event-pipeline")).toBe("ready");
    expect(statusFor(readiness.items, "ai-provider")).toBe("ready");
    expect(statusFor(readiness.items, "observability")).toBe("ready");
    expect(statusFor(readiness.items, "production-secrets")).toBe("ready");
    expect(readiness.summary.ready).toBe(5);
  });

  it("blocks production readiness when JWT secrets are placeholders", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_ACCESS_SECRET", "replace-me");
    vi.stubEnv("JWT_REFRESH_SECRET", "replace-me");

    const service = createService();
    const readiness = await service.readiness();

    expect(statusFor(readiness.items, "production-secrets")).toBe("blocked");
    expect(readiness.summary.blocked).toBe(1);
  });

  it("summarizes persisted usage records for dashboard metrics", async () => {
    const service = createService({
      usageRecords: [
        { aiTokensUsed: 120, workflowStepsExecuted: 4 },
        { aiTokensUsed: 30, workflowStepsExecuted: 2 }
      ]
    });

    await expect(service.overview()).resolves.toMatchObject({ aiTokensUsed: 150 });
    await expect(service.usage()).resolves.toEqual({
      aiTokensUsed: 150,
      workflowStepsExecuted: 6,
      plan: "FREE"
    });
  });
});

function createService(
  options: {
    activeWorkflow?: boolean;
    recentEvents?: Array<{ eventId: string }>;
    usageRecords?: Array<{ aiTokensUsed: number; workflowStepsExecuted: number }>;
  } = {}
) {
  const workflows = {
    findAll: vi.fn(async () => [
      {
        id: "wf_lead_qualification",
        status: options.activeWorkflow ? "ACTIVE" : "DRAFT"
      }
    ]),
    listRuns: vi.fn(async () => [])
  };
  const events = {
    listRecent: vi.fn(async () => options.recentEvents ?? [])
  };
  const prisma = {
    client: {
      usageRecord: {
        findMany: vi.fn(async () => options.usageRecords ?? [])
      },
      workspace: {
        findUnique: vi.fn(async () => ({ plan: "FREE" }))
      }
    }
  };
  const demoData = {
    ensureDemoWorkspace: vi.fn(async () => ({ id: "ws_demo" }))
  };

  return new DashboardService(workflows as never, events as never, prisma as never, demoData as never);
}

function statusFor(items: Array<{ id: string; status: ReadinessStatus }>, id: string) {
  const item = items.find((candidate) => candidate.id === id);
  expect(item).toBeDefined();
  return item?.status;
}
