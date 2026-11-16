import { eventEnvelopeSchema, type EventEnvelope } from "@agentops/events";

export type NotificationRecord = {
  workspaceId: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

export interface NotificationSink {
  create(notification: NotificationRecord): Promise<void>;
}

/** Turns `notification-requested` into an in-app notification (a sales task when kind = SALES_TASK). */
export function toNotificationRecord(rawEvent: unknown, now = new Date()): NotificationRecord {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const title = typeof event.payload["title"] === "string" ? event.payload["title"] : "AgentOps notification";
  const body = typeof event.payload["body"] === "string" ? event.payload["body"] : "A workflow event was processed.";
  const type = typeof event.payload["kind"] === "string" ? event.payload["kind"] : "INFO";
  const dueInHours = Number(event.payload["dueInHours"]);

  return {
    workspaceId: event.workspaceId,
    type,
    title,
    body,
    metadata: {
      workflowRunId: event.workflowRunId,
      workflowId: event.workflowId,
      nodeId: event.payload["nodeId"],
      sourceEventId: event.eventId,
      ...(Number.isFinite(dueInHours) && dueInHours > 0
        ? { dueAt: new Date(now.getTime() + dueInHours * 3_600_000).toISOString() }
        : {})
    }
  };
}

export async function handleNotificationRequested(rawEvent: unknown, sink: NotificationSink): Promise<EventEnvelope[]> {
  await sink.create(toNotificationRecord(rawEvent));
  return [];
}
