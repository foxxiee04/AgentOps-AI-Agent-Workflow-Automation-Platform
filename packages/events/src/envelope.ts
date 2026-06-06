import { z } from "zod";
import { kafkaTopics } from "./topics";

export const eventTypeSchema = z.enum([
  kafkaTopics.workflowTriggered,
  kafkaTopics.workflowStepStarted,
  kafkaTopics.workflowStepCompleted,
  kafkaTopics.workflowStepFailed,
  kafkaTopics.agentTaskRequested,
  kafkaTopics.agentTaskCompleted,
  kafkaTopics.toolCallRequested,
  kafkaTopics.toolCallCompleted,
  kafkaTopics.humanApprovalRequested,
  kafkaTopics.notificationRequested,
  kafkaTopics.workflowCompleted,
  kafkaTopics.workflowFailed,
  kafkaTopics.deadLetterEvents
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  type: eventTypeSchema,
  workspaceId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  workflowRunId: z.string().min(1),
  timestamp: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({})
});
export type EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = Omit<
  z.infer<typeof eventEnvelopeSchema>,
  "payload"
> & {
  payload: TPayload;
};

export function getIdempotencyKey(event: Pick<EventEnvelope, "type" | "workflowRunId" | "eventId">): string {
  return `${event.type}:${event.workflowRunId}:${event.eventId}`;
}

