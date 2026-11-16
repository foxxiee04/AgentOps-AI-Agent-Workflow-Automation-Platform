import { z } from "zod";
import { aiProviderSchema, workflowDefinitionSchema } from "@agentops/shared";

export const workflowTriggeredPayloadSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
  triggerType: z.enum(["manual", "webhook", "scheduled", "mock"]).default("manual")
});
export type WorkflowTriggeredPayload = z.infer<typeof workflowTriggeredPayloadSchema>;

export const agentTaskRequestedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  taskId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  config: z.record(z.string(), z.unknown()).default({}),
  definition: workflowDefinitionSchema.optional(),
  context: z.record(z.string(), z.unknown()).default({})
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
    .default({ inputTokens: 0, outputTokens: 0 }),
  provider: aiProviderSchema.default("mock"),
  modelName: z.string().min(1).default("mock-lead-scorer"),
  latencyMs: z.number().int().nonnegative().default(0),
  validation: z
    .object({
      schemaValid: z.boolean(),
      errors: z.array(z.string()).default([])
    })
    .default({ schemaValid: true, errors: [] }),
  definition: workflowDefinitionSchema.optional(),
  context: z.record(z.string(), z.unknown()).default({})
});
export type AgentTaskCompletedPayload = z.infer<typeof agentTaskCompletedPayloadSchema>;

export const toolCallRequestedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolType: z.enum(["webhook", "http_request", "email_mock"]),
  input: z.record(z.string(), z.unknown()).default({}),
  config: z.record(z.string(), z.unknown()).default({}),
  definition: workflowDefinitionSchema.optional(),
  context: z.record(z.string(), z.unknown()).default({})
});
export type ToolCallRequestedPayload = z.infer<typeof toolCallRequestedPayloadSchema>;

export const workflowDefinitionPayloadSchema = z.object({
  workflowVersionId: z.string().min(1),
  definition: workflowDefinitionSchema
});
export type WorkflowDefinitionPayload = z.infer<typeof workflowDefinitionPayloadSchema>;

export const stepCompletedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  output: z.record(z.string(), z.unknown()).default({}),
  definition: workflowDefinitionSchema.optional(),
  context: z.record(z.string(), z.unknown()).default({})
});
export type StepCompletedPayload = z.infer<typeof stepCompletedPayloadSchema>;

export const humanApprovalDecidedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(2000).optional(),
  decidedBy: z.string().min(1),
  definition: workflowDefinitionSchema,
  context: z.record(z.string(), z.unknown()).default({})
});
export type HumanApprovalDecidedPayload = z.infer<typeof humanApprovalDecidedPayloadSchema>;

export const workflowStepFailedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  message: z.string().default("Step failed"),
  attempts: z.number().int().nonnegative().optional()
});
export type WorkflowStepFailedPayload = z.infer<typeof workflowStepFailedPayloadSchema>;
