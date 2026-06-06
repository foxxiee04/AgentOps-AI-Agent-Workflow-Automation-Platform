import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { handleAgentTaskRequested } from "./agent-task.handler";

describe("handleAgentTaskRequested", () => {
  it("returns a structured AI completion event", () => {
    const event = createEvent({
      type: kafkaTopics.agentTaskRequested,
      workspaceId: "ws_demo",
      workflowId: "wf_demo",
      workflowRunId: "run_demo",
      payload: {
        nodeId: "ai-1",
        taskId: "task-1",
        input: { message: "We need urgent sales automation." },
        config: { modelProvider: "mock" }
      }
    });

    const completed = handleAgentTaskRequested(event);
    expect(completed.type).toBe(kafkaTopics.agentTaskCompleted);
    expect(completed.payload.output).toMatchObject({ leadScore: 87 });
  });
});

