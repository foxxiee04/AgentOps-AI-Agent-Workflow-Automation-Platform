import { ForbiddenException, NotFoundException } from "@nestjs/common";
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
    const readiness = await service.readiness("ws_test");

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
    const readiness = await service.readiness("ws_test");

    expect(statusFor(readiness.items, "workflow-publishing")).toBe("ready");
    expect(statusFor(readiness.items, "event-pipeline")).toBe("ready");
    expect(statusFor(readiness.items, "ai-provider")).toBe("ready");
    expect(statusFor(readiness.items, "observability")).toBe("ready");
    expect(statusFor(readiness.items, "production-secrets")).toBe("ready");
    expect(readiness.summary.ready).toBe(5);
    expect(readiness.workspaceId).toBe("ws_test");
  });

  it("blocks production readiness when JWT secrets are placeholders", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_ACCESS_SECRET", "replace-me");
    vi.stubEnv("JWT_REFRESH_SECRET", "replace-me");

    const service = createService();
    const readiness = await service.readiness("ws_test");

    expect(statusFor(readiness.items, "production-secrets")).toBe("blocked");
    expect(readiness.summary.blocked).toBe(1);
  });

  it("summarizes persisted usage records and database run counts for dashboard metrics", async () => {
    const workflowRunCount = vi.fn(async (args: { where: { status?: string } }) => (args.where.status === "FAILED" ? 7 : 1234));
    const service = createService({
      usageRecords: [
        { aiTokensUsed: 120, workflowStepsExecuted: 4 },
        { aiTokensUsed: 30, workflowStepsExecuted: 2 }
      ],
      workflowRunCount
    });

    await expect(service.overview("ws_test")).resolves.toMatchObject({ aiTokensUsed: 150, runsToday: 1234, failedRuns: 7 });
    expect(workflowRunCount).toHaveBeenCalledWith({ where: { workspaceId: "ws_test", createdAt: { gte: expect.any(Date) } } });
    expect(workflowRunCount).toHaveBeenCalledWith({
      where: { workspaceId: "ws_test", status: "FAILED", createdAt: { gte: expect.any(Date) } }
    });

    await expect(service.usage("ws_test")).resolves.toEqual({
      aiTokensUsed: 150,
      workflowStepsExecuted: 6,
      plan: "FREE"
    });
  });
});

describe("DashboardService AI provider readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("warns that only the mock provider is configured when no real provider key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");

    const service = createService();
    const readiness = await service.readiness("ws_test");

    expect(statusFor(readiness.items, "ai-provider")).toBe("warning");
    expect(itemFor(readiness.items, "ai-provider").summary).toBe(
      "Only the mock provider is configured; set OPENAI_API_KEY to use a real model."
    );
  });

  it("does not treat a placeholder non-OpenAI key as a real provider", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gemini-placeholder-key");

    const service = createService();
    const readiness = await service.readiness("ws_test");

    expect(statusFor(readiness.items, "ai-provider")).toBe("warning");
    expect(itemFor(readiness.items, "ai-provider").summary).toBe(
      "Only the mock provider is configured; set OPENAI_API_KEY to use a real model."
    );
  });

  it("marks the AI provider ready once a real key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("GEMINI_API_KEY", "");

    const service = createService();
    const readiness = await service.readiness("ws_test");

    expect(statusFor(readiness.items, "ai-provider")).toBe("ready");
    expect(itemFor(readiness.items, "ai-provider").summary).toBe("At least one real AI provider key is configured.");
  });

  it("keeps the AI provider in warning when the key is blank", async () => {
    vi.stubEnv("OPENAI_API_KEY", "   ");

    const service = createService();
    const readiness = await service.readiness("ws_test");

    expect(statusFor(readiness.items, "ai-provider")).toBe("warning");
  });
});

describe("DashboardService workflow run list", () => {
  it("passes paging and filters through to the run query and returns the workflow name", async () => {
    const findMany = vi.fn(async () => [workflowRunRow()]);
    const count = vi.fn(async () => 42);
    const service = createService({ workflowRunFindMany: findMany, workflowRunCount: count });

    const result = await service.workflowRuns("ws_test", { limit: 10, offset: 20, status: "FAILED", workflowId: "wf_1" });

    expect(findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_test", status: "FAILED", workflowId: "wf_1" },
      orderBy: { createdAt: "desc" },
      skip: 20,
      take: 10,
      include: { workflow: { select: { name: true } } }
    });
    expect(count).toHaveBeenCalledWith({ where: { workspaceId: "ws_test", status: "FAILED", workflowId: "wf_1" } });
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "run_1",
      workflowId: "wf_1",
      workflowName: "Lead qualification",
      status: "COMPLETED"
    });
  });

  it("defaults to the first 50 runs without filters", async () => {
    const findMany = vi.fn(async () => []);
    const count = vi.fn(async () => 0);
    const service = createService({ workflowRunFindMany: findMany, workflowRunCount: count });

    await service.workflowRuns("ws_test");

    expect(findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_test" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 50,
      include: { workflow: { select: { name: true } } }
    });
    expect(count).toHaveBeenCalledWith({ where: { workspaceId: "ws_test" } });
  });

  it("masks lead input on the dashboard run rows", async () => {
    const service = createService({
      workflowRunFindMany: vi.fn(async () => [
        {
          ...workflowRunRow(),
          inputJson: { name: "Anna", email: "anna@shopabc.vn" }
        }
      ])
    });

    const result = await service.workflowRuns("ws_test");

    expect(result.items[0].input).toEqual({ name: "Anna", email: "an***@shopabc.vn" });
  });

  it("counts the runs matching the same filters", async () => {
    const count = vi.fn(async () => 7);
    const service = createService({ workflowRunCount: count });

    await expect(service.countWorkflowRuns("ws_test", { status: "COMPLETED", workflowId: "wf_1" })).resolves.toEqual({
      total: 7
    });
    expect(count).toHaveBeenCalledWith({ where: { workspaceId: "ws_test", status: "COMPLETED", workflowId: "wf_1" } });
  });
});

describe("DashboardService lead outputs", () => {
  it("lists scored leads with masked contact data and skips non-scoring AI results", async () => {
    const leads = await createService().leads("ws_test");

    expect(leads).toEqual([
      expect.objectContaining({
        workflowRunId: "run_1",
        name: "Anna",
        email: "an***@shopabc.vn",
        leadScore: 87,
        category: "high-intent",
        modelName: "gpt-4o-mini"
      })
    ]);
  });

  it("lists sales tasks with their due date", async () => {
    const tasks = await createService().salesTasks("ws_test");
    expect(tasks).toEqual([
      expect.objectContaining({ title: "Call lead back within 24 hours", dueAt: "2026-10-19T08:00:00.000Z", workflowRunId: "run_1" })
    ]);
  });
});

describe("DashboardService sales tasks", () => {
  it("maps stored notification status to OPEN/DONE and flags overdue open tasks", async () => {
    const service = createService({
      notifications: [
        salesTaskRow({
          id: "notif_done",
          status: "DONE",
          metadataJson: { dueAt: "2020-01-01T00:00:00.000Z" },
          createdAt: new Date("2026-10-20T08:00:00Z")
        }),
        salesTaskRow({
          id: "notif_open_past_due",
          status: "UNREAD",
          metadataJson: { dueAt: "2020-01-01T00:00:00.000Z" },
          createdAt: new Date("2026-10-18T08:00:00Z")
        }),
        salesTaskRow({
          id: "notif_open_future_due",
          status: "UNREAD",
          metadataJson: { dueAt: "2999-01-01T00:00:00.000Z" },
          createdAt: new Date("2026-10-19T08:00:00Z")
        })
      ]
    });

    const tasks = await service.salesTasks("ws_test");

    // Open tasks first, newest first inside each group.
    expect(tasks.map((task) => task.id)).toEqual(["notif_open_future_due", "notif_open_past_due", "notif_done"]);
    expect(tasks[0]).toMatchObject({ status: "OPEN", overdue: false });
    expect(tasks[1]).toMatchObject({ status: "OPEN", overdue: true });
    expect(tasks[2]).toMatchObject({ status: "DONE", overdue: false });
  });

  it("treats a task without a due date as not overdue", async () => {
    const service = createService({ notifications: [salesTaskRow({ id: "notif_no_due", metadataJson: {} })] });

    const tasks = await service.salesTasks("ws_test");

    expect(tasks[0]).toMatchObject({ status: "OPEN", overdue: false });
    expect(tasks[0].dueAt).toBeUndefined();
  });

  it("stores DONE when a task is completed", async () => {
    const update = vi.fn(async () => salesTaskRow({ id: "notif_1", status: "DONE" }));
    const service = createService({
      notificationById: salesTaskRow({ id: "notif_1" }),
      workspaceMember: { role: "MEMBER" },
      notificationUpdate: update
    });

    const task = await service.updateSalesTask("notif_1", { status: "DONE" }, "user_1", "ws_test");

    expect(update).toHaveBeenCalledWith({ where: { id: "notif_1" }, data: { status: "DONE" } });
    expect(task).toMatchObject({ id: "notif_1", status: "DONE" });
  });

  it("stores UNREAD when a task is re-opened", async () => {
    const update = vi.fn(async () => salesTaskRow({ id: "notif_1", status: "UNREAD" }));
    const service = createService({
      notificationById: salesTaskRow({ id: "notif_1", status: "DONE" }),
      workspaceMember: { role: "ADMIN" },
      notificationUpdate: update
    });

    const task = await service.updateSalesTask("notif_1", { status: "OPEN" }, "user_1", "ws_test");

    expect(update).toHaveBeenCalledWith({ where: { id: "notif_1" }, data: { status: "UNREAD" } });
    expect(task).toMatchObject({ id: "notif_1", status: "OPEN" });
  });

  it("returns 404 when the sales task does not exist", async () => {
    const service = createService({ notificationById: null, workspaceMember: { role: "OWNER" } });

    await expect(service.updateSalesTask("missing", { status: "DONE" }, "user_1", "ws_test")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("returns 404 when the task belongs to a different workspace", async () => {
    const service = createService({
      notificationById: salesTaskRow({ id: "notif_1", workspaceId: "ws_other" }),
      workspaceMember: { role: "OWNER" }
    });

    await expect(service.updateSalesTask("notif_1", { status: "DONE" }, "user_1", "ws_test")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("returns 404 when the notification is not a sales task", async () => {
    const service = createService({
      notificationById: salesTaskRow({ id: "notif_1", type: "ALERT" }),
      workspaceMember: { role: "OWNER" }
    });

    await expect(service.updateSalesTask("notif_1", { status: "DONE" }, "user_1", "ws_test")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("forbids callers who are not members of the task workspace", async () => {
    const service = createService({
      notificationById: salesTaskRow({ id: "notif_1" }),
      workspaceMember: null
    });

    await expect(service.updateSalesTask("notif_1", { status: "DONE" }, "user_1", "ws_test")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("forbids workspace viewers from completing a sales task", async () => {
    const service = createService({
      notificationById: salesTaskRow({ id: "notif_1" }),
      workspaceMember: { role: "VIEWER" }
    });

    await expect(service.updateSalesTask("notif_1", { status: "DONE" }, "user_1", "ws_test")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

describe("DashboardService workspace scoping", () => {
  it("filters usage records and lead results by the requested workspace", async () => {
    const usageFindMany = vi.fn(async () => []);
    const aiTaskResultFindMany = vi.fn(async () => []);
    const service = createService({ usageFindMany, aiTaskResultFindMany });

    await service.usage("ws_test");
    await service.leads("ws_test");

    expect(usageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws_test" }) })
    );
    expect(aiTaskResultFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_test" } }));
  });

  it("filters sales tasks and recent activity by the requested workspace", async () => {
    const notificationFindMany = vi.fn(async () => []);
    const listRecent = vi.fn(async () => []);
    const service = createService({ notificationFindMany, listRecent });

    await service.salesTasks("ws_test");
    await service.recentActivity("ws_test");

    expect(notificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws_test", type: "SALES_TASK" } })
    );
    expect(listRecent).toHaveBeenCalledWith("ws_test");
  });

  it("reads the plan of the requested workspace", async () => {
    const workspaceFindUnique = vi.fn(async () => ({ plan: "PRO" }));
    const service = createService({ workspaceFindUnique });

    await expect(service.usage("ws_test")).resolves.toMatchObject({ plan: "PRO" });
    expect(workspaceFindUnique).toHaveBeenCalledWith({ where: { id: "ws_test" } });
  });
});

function workflowRunRow() {
  return {
    id: "run_1",
    workflowId: "wf_1",
    workflowVersionId: "wfv_1",
    workspaceId: "ws_test",
    status: "COMPLETED",
    triggerType: "manual",
    inputJson: { name: "Anna" },
    triggerEventId: "evt_1",
    createdAt: new Date("2026-10-18T08:00:00Z"),
    startedAt: new Date("2026-10-18T08:00:01Z"),
    finishedAt: new Date("2026-10-18T08:00:05Z"),
    errorMessage: null,
    workflow: { name: "Lead qualification" }
  };
}

function salesTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif_1",
    workspaceId: "ws_test",
    type: "SALES_TASK",
    title: "Call lead back within 24 hours",
    body: "Anna — Shop ABC (score 87)",
    status: "UNREAD",
    metadataJson: { dueAt: "2026-10-19T08:00:00.000Z", workflowRunId: "run_1" },
    createdAt: new Date("2026-10-18T08:00:02Z"),
    ...overrides
  };
}

function createService(
  options: {
    activeWorkflow?: boolean;
    recentEvents?: Array<{ eventId: string }>;
    listRecent?: ReturnType<typeof vi.fn>;
    usageRecords?: Array<{ aiTokensUsed: number; workflowStepsExecuted: number }>;
    workflowRunCount?: ReturnType<typeof vi.fn>;
    workflowRunFindMany?: ReturnType<typeof vi.fn>;
    notifications?: Array<Record<string, unknown>>;
    notificationById?: Record<string, unknown> | null;
    notificationUpdate?: ReturnType<typeof vi.fn>;
    notificationFindMany?: ReturnType<typeof vi.fn>;
    usageFindMany?: ReturnType<typeof vi.fn>;
    workspaceFindUnique?: ReturnType<typeof vi.fn>;
    aiTaskResultFindMany?: ReturnType<typeof vi.fn>;
    workspaceMember?: { role: string } | null;
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
    listRecent: options.listRecent ?? vi.fn(async (_workspaceId?: string) => options.recentEvents ?? [])
  };
  const prisma = {
    client: {
      usageRecord: {
        findMany: options.usageFindMany ?? vi.fn(async () => options.usageRecords ?? [])
      },
      workspace: {
        findUnique: options.workspaceFindUnique ?? vi.fn(async () => ({ plan: "FREE" }))
      },
      aiTaskResult: {
        findMany: options.aiTaskResultFindMany ?? vi.fn(async () => [
          {
            workflowRunId: "run_1",
            createdAt: new Date("2026-10-18T08:00:00Z"),
            modelName: "gpt-4o-mini",
            outputJson: { leadScore: 87, category: "high-intent", summary: "Needs chat automation", confidence: 0.9 },
            workflowRun: { inputJson: { name: "Anna", company: "Shop ABC", email: "anna@shopabc.vn", source: "website_form" } }
          },
          {
            workflowRunId: "run_1",
            createdAt: new Date("2026-10-18T08:00:01Z"),
            modelName: "gpt-4o-mini",
            outputJson: { subject: "Hi", body: "Hello" },
            workflowRun: { inputJson: {} }
          }
        ])
      },
      workflowRun: {
        count: options.workflowRunCount ?? vi.fn(async () => 0),
        findMany: options.workflowRunFindMany ?? vi.fn(async () => [])
      },
      notification: {
        findMany: options.notificationFindMany ?? vi.fn(async () => options.notifications ?? [salesTaskRow()]),
        findUnique: vi.fn(async () => options.notificationById ?? null),
        update: options.notificationUpdate ?? vi.fn(async () => salesTaskRow())
      },
      workspaceMember: {
        findUnique: vi.fn(async () => options.workspaceMember ?? null)
      }
    }
  };
  return new DashboardService(workflows as never, events as never, prisma as never);
}

function statusFor(items: Array<{ id: string; status: ReadinessStatus }>, id: string) {
  const item = items.find((candidate) => candidate.id === id);
  expect(item).toBeDefined();
  return item?.status;
}

function itemFor(items: Array<{ id: string; status: ReadinessStatus; summary: string }>, id: string) {
  const item = items.find((candidate) => candidate.id === id);
  expect(item).toBeDefined();
  return item as { id: string; status: ReadinessStatus; summary: string };
}
