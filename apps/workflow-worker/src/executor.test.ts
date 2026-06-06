import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { handleWorkflowTriggered } from "./executor";

describe("handleWorkflowTriggered", () => {
  it("creates task requests for executable workflow nodes", () => {
    const event = createEvent({
      type: kafkaTopics.workflowTriggered,
      workspaceId: "ws_demo",
      workflowId: "wf_demo",
      workflowRunId: "run_demo",
      payload: {
        input: { leadName: "Anna" },
        triggerType: "manual",
        workflowVersionId: "wfv_demo",
        definition: sampleLeadWorkflowDefinition
      }
    });

    const plan = handleWorkflowTriggered(event);

    expect(plan.issues).toEqual([]);
    expect(plan.taskRequests.map((task) => task.type)).toContain(kafkaTopics.agentTaskRequested);
    expect(plan.taskRequests.map((task) => task.type)).toContain(kafkaTopics.toolCallRequested);
  });
});

