import {
  agentTaskRequestedPayloadSchema,
  createEvent,
  eventEnvelopeSchema,
  kafkaTopics,
  type EventEnvelope
} from "@agentops/events";
import { executeAgentTask } from "./ai-task.executor";

export async function handleAgentTaskRequested(rawEvent: unknown): Promise<EventEnvelope> {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = agentTaskRequestedPayloadSchema.parse(event.payload);
  const result = await executeAgentTask({
    input: payload.input,
    config: payload.config
  });

  return createEvent({
    type: kafkaTopics.agentTaskCompleted,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    payload: {
      nodeId: payload.nodeId,
      taskId: payload.taskId,
      output: result.output,
      tokenUsage: result.tokenUsage,
      provider: result.provider,
      modelName: result.modelName,
      latencyMs: result.latencyMs,
      validation: result.validation
    }
  });
}
