import {
  createEvent,
  eventEnvelopeSchema,
  kafkaTopics,
  traceContextFromEvent,
  toolCallRequestedPayloadSchema,
  type EventEnvelope
} from "@agentops/events";

export function handleToolCallRequested(rawEvent: unknown): EventEnvelope {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = toolCallRequestedPayloadSchema.parse(event.payload);

  if (payload.toolType === "http_request" && !["GET", "POST"].includes(String(payload.config["method"] ?? "GET"))) {
    return createFailure(event, payload.nodeId, "Only GET and POST are allowed in the MVP.");
  }

  return createEvent({
    type: kafkaTopics.toolCallCompleted,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    ...traceContextFromEvent(event),
    payload: {
      nodeId: payload.nodeId,
      toolCallId: payload.toolCallId,
      toolType: payload.toolType,
      status: "mock_completed",
      output: {
        message: `${payload.toolType} executed in mock mode`,
        receivedInput: payload.input
      }
    }
  });
}

function createFailure(event: EventEnvelope, nodeId: string, message: string): EventEnvelope {
  return createEvent({
    type: kafkaTopics.workflowStepFailed,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    ...traceContextFromEvent(event),
    payload: { nodeId, message }
  });
}
