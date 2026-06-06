import {
  agentTaskRequestedPayloadSchema,
  createEvent,
  eventEnvelopeSchema,
  kafkaTopics,
  type EventEnvelope
} from "@agentops/events";
import { leadScoreResultSchema, maskSensitivePromptInput } from "@agentops/shared";

export function handleAgentTaskRequested(rawEvent: unknown): EventEnvelope {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = agentTaskRequestedPayloadSchema.parse(event.payload);
  const safeInput = maskSensitivePromptInput(payload.input);

  const output = leadScoreResultSchema.parse({
    leadScore: inferLeadScore(safeInput),
    category: "high-intent",
    summary: "The lead is interested in workflow automation and AI-supported operations.",
    recommendedAction: "Create a sales follow-up task and send a concise personalized email.",
    personalizedEmail: "Hi, thanks for sharing your automation needs. AgentOps can help qualify leads and trigger follow-up workflows."
  });

  return createEvent({
    type: kafkaTopics.agentTaskCompleted,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    payload: {
      nodeId: payload.nodeId,
      taskId: payload.taskId,
      output,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0
      },
      provider: payload.config["modelProvider"] ?? "mock"
    }
  });
}

function inferLeadScore(input: unknown): number {
  const text = JSON.stringify(input).toLowerCase();
  if (text.includes("urgent") || text.includes("automation") || text.includes("sales")) {
    return 87;
  }
  return 62;
}

