import { z } from "zod";
import { workflowDefinitionSchema } from "@agentops/shared";

export const workflowTriggeredPayloadSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
  triggerType: z.enum(["manual", "webhook", "scheduled", "mock"]).default("manual")
});
export type WorkflowTriggeredPayload = z.infer<typeof workflowTriggeredPayloadSchema>;

export const agentTaskRequestedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  config: z.record(z.string(), z.unknown()).default({})
});
export type AgentTaskRequestedPayload = z.infer<typeof agentTaskRequestedPayloadSchema>;

export const agentTaskCompletedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
  output: z.record(z.string(), z.unknown()),
  tokenUsage: z
    .object({
      inputTokens: z.number().int().nonnegative().default(0),
      outputTokens: z.number().int().nonnegative().default(0)
    })
    .default({ inputTokens: 0, outputTokens: 0 })
});
export type AgentTaskCompletedPayload = z.infer<typeof agentTaskCompletedPayloadSchema>;

export const toolCallRequestedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolType: z.enum(["webhook", "http_request", "email_mock"]),
  input: z.record(z.string(), z.unknown()).default({}),
  config: z.record(z.string(), z.unknown()).default({})
});
export type ToolCallRequestedPayload = z.infer<typeof toolCallRequestedPayloadSchema>;

export const workflowDefinitionPayloadSchema = z.object({
  workflowVersionId: z.string().min(1),
  definition: workflowDefinitionSchema
});
export type WorkflowDefinitionPayload = z.infer<typeof workflowDefinitionPayloadSchema>;

