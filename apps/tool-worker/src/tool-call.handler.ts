import { maskSensitivePromptInput } from "@agentops/shared";
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
      definition: payload.definition,
      context: payload.context,
      output: mockToolOutput(payload.toolType, payload.input, payload.config)
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

/** Mock delivery result. Never echoes the raw input: it holds lead PII and is stored on the step. */
function mockToolOutput(toolType: string, input: Record<string, unknown>, config: Record<string, unknown>) {
  if (toolType === "email_mock") {
    return {
      mode: "mock",
      delivered: true,
      to: maskSensitivePromptInput(String(input["email"] ?? "")),
      subject: String(input["subject"] ?? config["subject"] ?? "")
    };
  }

  return { mode: "mock", delivered: true, url: String(config["url"] ?? ""), method: String(config["method"] ?? "POST") };
}
