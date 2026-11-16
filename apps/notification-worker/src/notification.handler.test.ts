import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { handleNotificationRequested, toNotificationRecord, type NotificationRecord } from "./notification.handler";

describe("notification handler", () => {
  it("creates a sales task due in 24 hours", () => {
    const event = createEvent({
      type: kafkaTopics.notificationRequested,
      workspaceId: "ws_demo",
      workflowId: "wf_demo",
      workflowRunId: "run_demo",
      payload: { nodeId: "notify-1", kind: "SALES_TASK", title: "Call lead back within 24 hours", body: "Anna", dueInHours: 24 }
    });

    const record = toNotificationRecord(event, new Date("2026-10-18T00:00:00.000Z"));

    expect(record).toMatchObject({ workspaceId: "ws_demo", type: "SALES_TASK", title: "Call lead back within 24 hours" });
    expect(record.metadata).toMatchObject({ workflowRunId: "run_demo", nodeId: "notify-1", dueAt: "2026-10-19T00:00:00.000Z" });
  });

  it("writes the notification through the sink", async () => {
    const created: NotificationRecord[] = [];
    const event = createEvent({
      type: kafkaTopics.notificationRequested,
      workspaceId: "ws_demo",
      workflowRunId: "run_demo",
      payload: { title: "Review needed", body: "Approve a workflow run." }
    });

    expect(await handleNotificationRequested(event, { create: async (record) => void created.push(record) })).toEqual([]);
    expect(created[0]).toMatchObject({ type: "INFO", title: "Review needed" });
  });
});
