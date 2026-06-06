import { describe, expect, it } from "vitest";
import { createEvent, eventEnvelopeSchema, getIdempotencyKey, kafkaTopics } from "./index";

describe("event envelope", () => {
  it("creates valid workflow events", () => {
    const event = createEvent({
      type: kafkaTopics.workflowTriggered,
      workspaceId: "ws_1",
      workflowId: "wf_1",
      workflowRunId: "run_1",
      payload: { input: { leadName: "Anna" } }
    });

    expect(eventEnvelopeSchema.parse(event).eventId).toMatch(/^evt_/);
    expect(getIdempotencyKey(event)).toContain("workflow-triggered:run_1");
  });
});

