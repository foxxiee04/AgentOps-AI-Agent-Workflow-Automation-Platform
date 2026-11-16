import { z } from "zod";
import { workflowNodeTypeSchema, workflowRunStatusSchema, workflowStepStatusSchema } from "./workflow";

/**
 * Response contracts shared by the API (which builds them) and the web app (which parses them).
 * Inputs are always masked before they reach these views.
 */

export const workflowRunViewSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workspaceId: z.string(),
  workflowVersionId: z.string(),
  status: workflowRunStatusSchema,
  triggerType: z.string(),
  /** masked trigger input */
  input: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  errorMessage: z.string().optional(),
  eventId: z.string().optional()
});
export type WorkflowRunView = z.infer<typeof workflowRunViewSchema>;

export const stepTokenUsageSchema = z.object({
  provider: z.string(),
  modelName: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number()
});
export type StepTokenUsage = z.infer<typeof stepTokenUsageSchema>;

export const workflowRunStepViewSchema = z.object({
  id: z.string(),
  workflowRunId: z.string(),
  nodeId: z.string(),
  nodeName: z.string(),
  nodeType: workflowNodeTypeSchema,
  status: workflowStepStatusSchema,
  message: z.string(),
  /** masked input the node received */
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorMessage: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  durationMs: z.number().optional(),
  retryCount: z.number().default(0),
  tokenUsage: stepTokenUsageSchema.optional()
});
export type WorkflowRunStepView = z.infer<typeof workflowRunStepViewSchema>;

export const workflowRunStepsViewSchema = z.object({
  workflowRunId: z.string(),
  steps: z.array(workflowRunStepViewSchema)
});
export type WorkflowRunStepsView = z.infer<typeof workflowRunStepsViewSchema>;

export const humanApprovalStatusSchema = z.enum(["WAITING_APPROVAL", "APPROVED", "REJECTED", "EXPIRED"]);
export type HumanApprovalStatus = z.infer<typeof humanApprovalStatusSchema>;

/** What the reviewer sees; written by the workflow-worker with PII already masked. */
export const approvalReviewSchema = z.object({
  lead: z.record(z.string(), z.unknown()).default({}),
  assessment: z
    .object({
      leadScore: z.number().optional(),
      category: z.string().optional(),
      summary: z.string().optional(),
      recommendedAction: z.string().optional()
    })
    .default({}),
  email: z.object({ subject: z.string().optional(), body: z.string().optional() }).default({})
});
export type ApprovalReview = z.infer<typeof approvalReviewSchema>;

export const humanApprovalViewSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workflowRunId: z.string(),
  nodeId: z.string(),
  stepId: z.string(),
  status: humanApprovalStatusSchema,
  review: approvalReviewSchema.catch({ lead: {}, assessment: {}, email: {} }),
  decidedById: z.string().optional(),
  comment: z.string().optional(),
  requestedAt: z.string(),
  decidedAt: z.string().optional()
});
export type HumanApprovalView = z.infer<typeof humanApprovalViewSchema>;

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(2000).optional()
});
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const approvalDecisionResultSchema = z.object({
  approval: humanApprovalViewSchema,
  eventId: z.string()
});
export type ApprovalDecisionResult = z.infer<typeof approvalDecisionResultSchema>;

/** Run statuses that can still change; the UI polls while a run is in one of them. */
export const activeRunStatuses = ["PENDING", "RUNNING", "WAITING_APPROVAL"] as const;

export function isRunActive(status: string) {
  return (activeRunStatuses as readonly string[]).includes(status);
}

/** A scored lead for the dashboard (contact fields masked). */
export const leadSummaryViewSchema = z.object({
  workflowRunId: z.string(),
  scoredAt: z.string(),
  name: z.string().optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional(),
  leadScore: z.number(),
  category: z.string(),
  summary: z.string().optional(),
  recommendedAction: z.string().optional(),
  confidence: z.number().optional(),
  modelName: z.string()
});
export type LeadSummaryView = z.infer<typeof leadSummaryViewSchema>;

/** Follow-up task for sales, created by the NOTIFICATION node. */
export const salesTaskViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.string(),
  dueAt: z.string().optional(),
  workflowRunId: z.string().optional(),
  createdAt: z.string()
});
export type SalesTaskView = z.infer<typeof salesTaskViewSchema>;
