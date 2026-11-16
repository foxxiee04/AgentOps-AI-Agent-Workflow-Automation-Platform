import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { handleToolCallRequested } from "./tool-call.handler";

describe("handleToolCallRequested", () => {
  it("rejects unsafe MVP HTTP methods", () => {
    const event = createEvent({
      type: kafkaTopics.toolCallRequested,
      workspaceId: "ws_demo",
      workflowId: "wf_demo",
      workflowRunId: "run_demo",
      payload: {
        nodeId: "http-1",
        toolCallId: "tool-1",
        toolType: "http_request",
        input: {},
        config: { method: "DELETE" }
      }
    });

    expect(handleToolCallRequested(event).type).toBe(kafkaTopics.workflowStepFailed);
  });

  it("returns a mock email result without echoing the lead's raw input", () => {
    const event = createEvent({
      type: kafkaTopics.toolCallRequested,
      workspaceId: "ws_demo",
      workflowId: "wf_demo",
      workflowRunId: "run_demo",
      payload: {
        nodeId: "email-1",
        toolCallId: "tool-2",
        toolType: "email_mock",
        input: { email: "anna@shopabc.vn", subject: "Automating Shop ABC", message: "secret details" },
        config: {}
      }
    });

    const result = handleToolCallRequested(event);

    expect(result.type).toBe(kafkaTopics.toolCallCompleted);
    expect(result.payload["output"]).toEqual({ mode: "mock", delivered: true, to: "an***@shopabc.vn", subject: "Automating Shop ABC" });
    expect(JSON.stringify(result.payload["output"])).not.toContain("secret details");
  });
});
