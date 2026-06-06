import { describe, expect, it } from "vitest";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { WorkflowsService } from "./workflows.service";

describe("WorkflowsService", () => {
  it("publishes a workflow-triggered event when running a workflow", () => {
    const events = new DomainEventsService();
    const service = new WorkflowsService(events);

    const result = service.run("wf_lead_qualification", {
      input: { leadName: "Anna" },
      triggerType: "manual"
    });

    expect(result.event.type).toBe("workflow-triggered");
    expect(result.run.workflowVersionId).toMatch(/^wfv_/);
  });
});

