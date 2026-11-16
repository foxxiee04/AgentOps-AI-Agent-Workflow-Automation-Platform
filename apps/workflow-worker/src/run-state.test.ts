import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { handleWorkflowEvent } from "./executor";
import { projectRunState } from "./run-state";

const base = { workspaceId: "ws_demo", workflowId: "wf_demo", workflowRunId: "run_demo" };

function trigger() {
  return createEvent({
    type: kafkaTopics.workflowTriggered,
    ...base,
    payload: { input: { name: "Anna", email: "anna@shopabc.vn" }, definition: sampleLeadWorkflowDefinition }
  });
}

describe("projectRunState", () => {
  it("marks the trigger completed and the AI step running with masked input", () => {
    const source = trigger();
    const change = projectRunState(source, handleWorkflowEvent(source));

    expect(change.runStatus).toBe("RUNNING");
    expect(change.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: "trigger-1", status: "COMPLETED" }),
        expect.objectContaining({ nodeId: "ai-1", status: "RUNNING", input: expect.objectContaining({ email: "an***@shopabc.vn" }) })
      ])
    );
    expect(change.context).toMatchObject({ email: "anna@shopabc.vn" });
  });

  it("records the AI result and completes a low score run, skipping the rest", () => {
    const scoring = handleWorkflowEvent(trigger()).taskRequests[0]!;
    const source = createEvent({
      type: kafkaTopics.agentTaskCompleted,
      ...base,
      payload: {
        nodeId: "ai-1",
        output: { leadScore: 30 },
        provider: "openai",
        modelName: "gpt-4o-mini",
        tokenUsage: { inputTokens: 120, outputTokens: 40 },
        definition: scoring.payload["definition"],
        context: scoring.payload["context"]
      }
    });
    const change = projectRunState(source, handleWorkflowEvent(source));

    expect(change.runStatus).toBe("COMPLETED");
    expect(change.skipPending).toBe(true);
    expect(change.aiResult).toMatchObject({ nodeId: "ai-1", modelName: "gpt-4o-mini", inputTokens: 120, outputTokens: 40 });
    expect(change.steps.find((step) => step.nodeId === "ai-1")).toMatchObject({ status: "COMPLETED", output: { leadScore: 30 } });
  });

  it("puts the run in WAITING_APPROVAL with the review payload", () => {
    const source = createEvent({
      type: kafkaTopics.agentTaskCompleted,
      ...base,
      payload: {
        nodeId: "ai-2",
        output: { subject: "Hi", body: "Hello" },
        definition: sampleLeadWorkflowDefinition,
        context: { name: "Anna", leadScore: 90 }
      }
    });
    const change = projectRunState(source, handleWorkflowEvent(source));

    expect(change.runStatus).toBe("WAITING_APPROVAL");
    expect(change.approvals).toEqual([expect.objectContaining({ nodeId: "approval-1" })]);
    expect(change.steps.find((step) => step.nodeId === "approval-1")?.status).toBe("WAITING_APPROVAL");
  });

  it("fails the run and the step when a step was dead-lettered, keeping the stored context", () => {
    const source = createEvent({ type: kafkaTopics.workflowStepFailed, ...base, payload: { nodeId: "ai-1", message: "timeout" } });
    const change = projectRunState(source, handleWorkflowEvent(source));

    expect(change.runStatus).toBe("FAILED");
    expect(change.context).toBeUndefined();
    expect(change.steps).toEqual([expect.objectContaining({ nodeId: "ai-1", status: "FAILED", errorMessage: "timeout" })]);
  });
});
