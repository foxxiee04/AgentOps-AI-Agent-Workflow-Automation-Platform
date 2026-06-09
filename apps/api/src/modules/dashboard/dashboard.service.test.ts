import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { WorkflowsService } from "../workflows/workflows.service";
import { DashboardService, type ReadinessStatus } from "./dashboard.service";

describe("DashboardService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("surfaces concrete next actions when the demo is not fully configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_ACCESS_SECRET", "replace-me");
    vi.stubEnv("JWT_REFRESH_SECRET", "replace-me");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OTEL_ENABLED", "false");

    const service = createService();
    const readiness = service.readiness();

    expect(statusFor(readiness.items, "workflow-publishing")).toBe("warning");
    expect(statusFor(readiness.items, "ai-provider")).toBe("warning");
    expect(statusFor(readiness.items, "observability")).toBe("warning");
    expect(statusFor(readiness.items, "production-secrets")).toBe("warning");
    expect(readiness.nextActions).toContain("Publish the lead qualification workflow and run it once from the Workflows screen.");
  });

  it("marks workflow, event, AI provider, and secrets as ready when configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_ACCESS_SECRET", "local-access-secret-for-tests");
    vi.stubEnv("JWT_REFRESH_SECRET", "local-refresh-secret-for-tests");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OTEL_ENABLED", "true");

    const events = new DomainEventsService();
    const workflows = new WorkflowsService(events);
    workflows.run("wf_lead_qualification", { input: { leadName: "Anna" }, triggerType: "manual" });

    const readiness = new DashboardService(workflows, events).readiness();

    expect(statusFor(readiness.items, "workflow-publishing")).toBe("ready");
    expect(statusFor(readiness.items, "event-pipeline")).toBe("ready");
    expect(statusFor(readiness.items, "ai-provider")).toBe("ready");
    expect(statusFor(readiness.items, "observability")).toBe("ready");
    expect(statusFor(readiness.items, "production-secrets")).toBe("ready");
    expect(readiness.summary.ready).toBe(5);
  });

  it("blocks production readiness when JWT secrets are placeholders", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_ACCESS_SECRET", "replace-me");
    vi.stubEnv("JWT_REFRESH_SECRET", "replace-me");

    const service = createService();
    const readiness = service.readiness();

    expect(statusFor(readiness.items, "production-secrets")).toBe("blocked");
    expect(readiness.summary.blocked).toBe(1);
  });
});

function createService() {
  const events = new DomainEventsService();
  const workflows = new WorkflowsService(events);
  return new DashboardService(workflows, events);
}

function statusFor(items: Array<{ id: string; status: ReadinessStatus }>, id: string) {
  const item = items.find((candidate) => candidate.id === id);
  expect(item).toBeDefined();
  return item?.status;
}
