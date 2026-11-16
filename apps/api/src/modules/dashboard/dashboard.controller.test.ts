import { describe, expect, it, vi } from "vitest";
import { DashboardController } from "./dashboard.controller";

describe("DashboardController", () => {
  it("returns the run array and publishes the total count header", async () => {
    const { controller } = createController();
    const response = { setHeader: vi.fn() };

    const runs = await controller.workflowRuns({ limit: 10 } as never, response as never);

    expect(response.setHeader).toHaveBeenCalledWith("X-Total-Count", "12");
    expect(runs).toEqual([{ id: "run_1" }]);
  });

  it("returns the matching total count as JSON for browsers that cannot read the header", async () => {
    const { controller, service } = createController();

    await expect(controller.countWorkflowRuns({ status: "FAILED" } as never)).resolves.toEqual({ total: 12 });
    expect(service.countWorkflowRuns).toHaveBeenCalledWith({ status: "FAILED" });
  });

  it("updates a sales task on behalf of the authenticated caller", async () => {
    const { controller, service } = createController();

    const task = await controller.updateSalesTask(
      "notif_1",
      { status: "DONE" } as never,
      { auth: { userId: "user_1", email: "member@agentops.local" } }
    );

    expect(service.updateSalesTask).toHaveBeenCalledWith("notif_1", { status: "DONE" }, "user_1");
    expect(task).toMatchObject({ id: "notif_1", status: "DONE" });
  });
});

function createController() {
  const service = {
    workflowRuns: vi.fn(async () => ({ items: [{ id: "run_1" }], total: 12 })),
    countWorkflowRuns: vi.fn(async () => ({ total: 12 })),
    updateSalesTask: vi.fn(async () => ({ id: "notif_1", status: "DONE" }))
  };

  return { controller: new DashboardController(service as never), service };
}
