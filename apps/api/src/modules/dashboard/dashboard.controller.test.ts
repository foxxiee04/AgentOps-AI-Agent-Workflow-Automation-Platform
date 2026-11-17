import { describe, expect, it, vi } from "vitest";
import { DashboardController } from "./dashboard.controller";

const request = { auth: { userId: "user_1", email: "member@agentops.local" }, user: { workspaceId: "ws_test" } };

describe("DashboardController", () => {
  it("returns the run array and publishes the total count header", async () => {
    const { controller, service } = createController();
    const response = { setHeader: vi.fn() };

    const runs = await controller.workflowRuns(request, { limit: 10, workspaceId: "ws_test" }, response as never);

    expect(response.setHeader).toHaveBeenCalledWith("X-Total-Count", "12");
    expect(service.workflowRuns).toHaveBeenCalledWith("ws_test", { limit: 10, workspaceId: "ws_test" });
    expect(runs).toEqual([{ id: "run_1" }]);
  });

  it("returns the matching total count as JSON for browsers that cannot read the header", async () => {
    const { controller, service } = createController();

    await expect(
      controller.countWorkflowRuns(request, { status: "FAILED", workspaceId: "ws_test" })
    ).resolves.toEqual({ total: 12 });
    expect(service.countWorkflowRuns).toHaveBeenCalledWith("ws_test", { status: "FAILED", workspaceId: "ws_test" });
  });

  it("scopes every read endpoint to the workspace resolved by the guard", async () => {
    const { controller, service } = createController();

    await controller.overview(request);
    await controller.usage(request);
    await controller.leads(request);
    await controller.salesTasks(request);
    await controller.errors(request);
    await controller.recentActivity(request);
    await controller.readiness(request);

    expect(service.overview).toHaveBeenCalledWith("ws_test");
    expect(service.usage).toHaveBeenCalledWith("ws_test");
    expect(service.leads).toHaveBeenCalledWith("ws_test");
    expect(service.salesTasks).toHaveBeenCalledWith("ws_test");
    expect(service.errors).toHaveBeenCalledWith("ws_test");
    expect(service.recentActivity).toHaveBeenCalledWith("ws_test");
    expect(service.readiness).toHaveBeenCalledWith("ws_test");
  });

  it("updates a sales task on behalf of the authenticated caller in the requested workspace", async () => {
    const { controller, service } = createController();

    const task = await controller.updateSalesTask("notif_1", { status: "DONE" } as never, request);

    expect(service.updateSalesTask).toHaveBeenCalledWith("notif_1", { status: "DONE" }, "user_1", "ws_test");
    expect(task).toMatchObject({ id: "notif_1", status: "DONE" });
  });
});

function createController() {
  const service = {
    overview: vi.fn(async () => ({})),
    workflowRuns: vi.fn(async () => ({ items: [{ id: "run_1" }], total: 12 })),
    countWorkflowRuns: vi.fn(async () => ({ total: 12 })),
    usage: vi.fn(async () => ({})),
    leads: vi.fn(async () => []),
    salesTasks: vi.fn(async () => []),
    errors: vi.fn(async () => []),
    recentActivity: vi.fn(async () => []),
    readiness: vi.fn(async () => ({})),
    updateSalesTask: vi.fn(async () => ({ id: "notif_1", status: "DONE" }))
  };

  return { controller: new DashboardController(service as never), service };
}
