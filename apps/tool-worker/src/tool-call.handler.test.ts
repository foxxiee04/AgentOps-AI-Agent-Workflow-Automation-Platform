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
});

