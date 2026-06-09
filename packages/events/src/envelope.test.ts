import { describe, expect, it } from "vitest";
import { createEvent, eventEnvelopeSchema, getIdempotencyKey, kafkaTopics, traceContextFromEvent } from "./index";

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

  it("propagates trace context into child events", () => {
    const parent = createEvent({
      type: kafkaTopics.workflowTriggered,
      workspaceId: "ws_1",
      workflowId: "wf_1",
      workflowRunId: "run_1",
      requestId: "req_1",
      traceId: "0123456789abcdef0123456789abcdef",
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      payload: {}
    });
    const child = createEvent({
      type: kafkaTopics.workflowStepStarted,
      workspaceId: "ws_1",
      workflowId: "wf_1",
      workflowRunId: "run_1",
      ...traceContextFromEvent(parent),
      payload: { nodeId: "trigger-1" }
    });

    expect(eventEnvelopeSchema.parse(child)).toMatchObject({
      requestId: "req_1",
      traceId: "0123456789abcdef0123456789abcdef",
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      parentEventId: parent.eventId
    });
  });
});
