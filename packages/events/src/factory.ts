import { randomUUID } from "node:crypto";
import type { EventEnvelope, EventType } from "./envelope";

export type CreateEventInput<TPayload extends Record<string, unknown>> = {
  type: EventType;
  workspaceId: string;
  workflowRunId: string;
  workflowId?: string;
  requestId?: string;
  traceId?: string;
  traceparent?: string;
  parentEventId?: string;
  payload: TPayload;
};

export function createEvent<TPayload extends Record<string, unknown>>(
  input: CreateEventInput<TPayload>
): EventEnvelope<TPayload> {
  return {
    eventId: `evt_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    type: input.type,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    workflowRunId: input.workflowRunId,
    requestId: input.requestId,
    traceId: input.traceId,
    traceparent: input.traceparent,
    parentEventId: input.parentEventId,
    payload: input.payload
  };
}

export function traceContextFromEvent(
  event: Pick<EventEnvelope, "eventId" | "requestId" | "traceId" | "traceparent">
): Pick<CreateEventInput<Record<string, unknown>>, "requestId" | "traceId" | "traceparent" | "parentEventId"> {
  return {
    requestId: event.requestId,
    traceId: event.traceId,
    traceparent: event.traceparent,
    parentEventId: event.eventId
  };
}
