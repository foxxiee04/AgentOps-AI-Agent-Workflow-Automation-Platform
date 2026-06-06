import { createEvent, eventEnvelopeSchema, kafkaTopics, type EventEnvelope } from "@agentops/events";

export function handleNotificationRequested(rawEvent: unknown): EventEnvelope {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const title = typeof event.payload["title"] === "string" ? event.payload["title"] : "AgentOps notification";
  const body = typeof event.payload["body"] === "string" ? event.payload["body"] : "A workflow event was processed.";

  return createEvent({
    type: kafkaTopics.workflowStepCompleted,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    payload: {
      notificationId: `notif_${event.eventId}`,
      title,
      body,
      status: "created"
    }
  });
}

