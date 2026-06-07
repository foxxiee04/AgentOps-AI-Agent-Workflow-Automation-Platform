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

  it("builds a run step timeline from the published workflow definition", () => {
    const events = new DomainEventsService();
    const service = new WorkflowsService(events);

    const result = service.run("wf_lead_qualification", {
      input: { leadName: "Anna" },
      triggerType: "manual"
    });
    const timeline = service.stepsForRun(result.run.id);

    expect(timeline.workflowRunId).toBe(result.run.id);
    expect(timeline.steps.map((step) => step.nodeId)).toEqual(["trigger-1", "ai-1", "condition-1", "webhook-1", "end-1"]);
    expect(timeline.steps[0]?.status).toBe("COMPLETED");
  });
});
