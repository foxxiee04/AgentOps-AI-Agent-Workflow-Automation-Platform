import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { handleNotificationRequested } from "./notification.handler";

describe("handleNotificationRequested", () => {
  it("creates a notification completion event", () => {
    const event = createEvent({
      type: kafkaTopics.notificationRequested,
      workspaceId: "ws_demo",
      workflowId: "wf_demo",
      workflowRunId: "run_demo",
      payload: { title: "Review needed", body: "Approve a workflow run." }
    });

    expect(handleNotificationRequested(event).payload.title).toBe("Review needed");
  });
});

