import { randomUUID } from "node:crypto";
import type { EventEnvelope, EventType } from "./envelope";

export type CreateEventInput<TPayload extends Record<string, unknown>> = {
  type: EventType;
  workspaceId: string;
  workflowRunId: string;
  workflowId?: string;
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
    payload: input.payload
  };
}

