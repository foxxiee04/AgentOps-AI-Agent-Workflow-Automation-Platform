import { z } from "zod";
import {
  defaultLeadEmailOutputSchema,
  defaultLeadScoringOutputSchema,
  leadEmailSystemPrompt,
  leadEmailUserPromptTemplate,
  leadScoringSystemPrompt,
  leadScoringUserPromptTemplate
} from "./ai";

export const workflowStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const workflowRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
]);
export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;

export const workflowStepStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "SKIPPED"
]);
export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>;

export const workflowNodeTypeSchema = z.enum([
  "TRIGGER",
  "AI_AGENT",
  "CONDITION",
  "WEBHOOK",
  "HTTP_REQUEST",
  "EMAIL_MOCK",
  "DELAY",
  "HUMAN_APPROVAL",
  "NOTIFICATION",
  "END"
]);
export type WorkflowNodeType = z.infer<typeof workflowNodeTypeSchema>;

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: workflowNodeTypeSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({})
});
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  condition: z.string().optional()
});
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema)
});
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

/**
 * Reserved edge condition: only taken when a reviewer rejected the approval.
 * It may only be used on edges leaving a HUMAN_APPROVAL node.
 */
export const rejectedEdgeCondition = "rejected";

/** The email a reviewer may edit before approving. */
export const editedEmailSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10000)
});
export type EditedEmail = z.infer<typeof editedEmailSchema>;

const conditionPattern = /^\s*([A-Za-z0-9_.-]+)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/;

function parseLiteral(raw: string): string | number | boolean {
  const text = raw.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (text === "true") return true;
  if (text === "false") return false;
  if (text !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
}

function valueAtPath(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, context);
}

/** True for the reserved `rejected` edge condition. */
export function isRejectedEdgeCondition(condition: string | undefined): boolean {
  return (condition ?? "").trim().toLowerCase() === rejectedEdgeCondition;
}

/** Outgoing edges that are only taken when the reviewer rejected the approval. */
export function selectRejectedEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
  return edges.filter((edge) => isRejectedEdgeCondition(edge.condition));
}

/**
 * True when the node has a `rejected` path. Such a run continues after a rejection
 * (the rejected branch replaces the cancelled run).
 */
export function hasRejectedPath(definition: WorkflowDefinition, nodeId: string): boolean {
  return selectRejectedEdges(definition.edges.filter((edge) => edge.source === nodeId)).length > 0;
}

/** Evaluates `<path> <op> <literal>` (e.g. `leadScore > 80`) against the run context. */
export function evaluateEdgeCondition(condition: string | undefined, context: Record<string, unknown>): boolean {
  if (condition === undefined || condition.trim() === "" || condition.trim() === "true") return true;
  if (condition.trim() === "false") return false;
  // The reserved condition is never a comparison: it reads the approval decision.
  if (isRejectedEdgeCondition(condition)) return context["approvalDecision"] === "rejected";

  const match = conditionPattern.exec(condition);
  if (!match) return false;

  const [, path, operator, rawLiteral] = match as unknown as [string, string, string, string];
  const actual = valueAtPath(context, path);
  const expected = parseLiteral(rawLiteral);
  if (actual === undefined || actual === null) return false;

  switch (operator) {
    case "==":
      return String(actual) === String(expected);
    case "!=":
      return String(actual) !== String(expected);
    default: {
      const left = Number(actual);
      const right = Number(expected);
      if (Number.isNaN(left) || Number.isNaN(right)) return false;
      if (operator === ">") return left > right;
      if (operator === ">=") return left >= right;
      if (operator === "<") return left < right;
      return left <= right;
    }
  }
}

/** Picks outgoing edges whose condition matches; `else`/`default` edges fire only if nothing else matched. */
export function selectOutgoingEdges(edges: WorkflowEdge[], context: Record<string, unknown>): WorkflowEdge[] {
  const isFallback = (edge: WorkflowEdge) => ["else", "default"].includes((edge.condition ?? "").trim().toLowerCase());
  const matched = edges.filter((edge) => !isFallback(edge) && evaluateEdgeCondition(edge.condition, context));
  return matched.length > 0 ? matched : edges.filter(isFallback);
}

export type WorkflowValidationIssue = {
  code:
    | "MISSING_TRIGGER"
    | "MISSING_END"
    | "DUPLICATE_NODE_ID"
    | "EDGE_SOURCE_MISSING"
    | "EDGE_TARGET_MISSING"
    | "UNREACHABLE_NODE"
    | "AI_SCHEMA_MISSING"
    | "WEBHOOK_URL_MISSING"
    | "REJECTED_EDGE_INVALID_SOURCE";
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) {
      duplicateIds.add(node.id);
    }
    nodeIds.add(node.id);

    if (node.type === "AI_AGENT" && !node.config.outputSchema) {
      issues.push({
        code: "AI_SCHEMA_MISSING",
        message: "AI Agent nodes must define an output schema.",
        nodeId: node.id
      });
    }

    if (node.type === "WEBHOOK" && !node.config.url) {
      issues.push({
        code: "WEBHOOK_URL_MISSING",
        message: "Webhook nodes must define a URL.",
        nodeId: node.id
      });
    }
  }

  for (const id of duplicateIds) {
    issues.push({
      code: "DUPLICATE_NODE_ID",
      message: `Node id '${id}' is duplicated.`,
      nodeId: id
    });
  }

  if (!definition.nodes.some((node) => node.type === "TRIGGER")) {
    issues.push({ code: "MISSING_TRIGGER", message: "Workflow must include at least one trigger node." });
  }

  if (!definition.nodes.some((node) => node.type === "END")) {
    issues.push({ code: "MISSING_END", message: "Workflow must include at least one end node." });
  }

  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({
        code: "EDGE_SOURCE_MISSING",
        message: `Edge '${edge.id}' references a missing source node.`,
        edgeId: edge.id
      });
    }

    if (!nodeIds.has(edge.target)) {
      issues.push({
        code: "EDGE_TARGET_MISSING",
        message: `Edge '${edge.id}' references a missing target node.`,
        edgeId: edge.id
      });
    }

    // The reserved `rejected` condition only makes sense on a HUMAN_APPROVAL node.
    if (isRejectedEdgeCondition(edge.condition)) {
      const source = definition.nodes.find((node) => node.id === edge.source);
      if (source && source.type !== "HUMAN_APPROVAL") {
        issues.push({
          code: "REJECTED_EDGE_INVALID_SOURCE",
          message: `Edge '${edge.id}' uses the reserved '${rejectedEdgeCondition}' condition, which is only allowed on a HUMAN_APPROVAL node.`,
          nodeId: source.id,
          edgeId: edge.id
        });
      }
    }
  }

  const triggerIds = definition.nodes.filter((node) => node.type === "TRIGGER").map((node) => node.id);
  const reachable = new Set<string>(triggerIds);
  const queue = [...triggerIds];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const edge of definition.edges.filter((candidate) => candidate.source === current)) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  for (const node of definition.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({
        code: "UNREACHABLE_NODE",
        message: `Node '${node.name}' is not reachable from a trigger.`,
        nodeId: node.id
      });
    }
  }

  return issues;
}

// Lead qualification: score -> branch on leadScore -> (hot) email draft -> approval -> mock send -> sales task.
export const sampleLeadWorkflowDefinition: WorkflowDefinition = {
  nodes: [
    { id: "trigger-1", type: "TRIGGER", name: "Lead received", config: { triggerType: "webhook" } },
    {
      id: "ai-1",
      type: "AI_AGENT",
      name: "Score lead",
      config: {
        modelProvider: "mock",
        modelName: "gpt-4o-mini",
        systemPrompt: leadScoringSystemPrompt,
        userPromptTemplate: leadScoringUserPromptTemplate,
        outputSchema: defaultLeadScoringOutputSchema,
        temperature: 0.2,
        retryLimit: 2
      }
    },
    { id: "condition-1", type: "CONDITION", name: "High intent?", config: { expression: "leadScore > 80" } },
    {
      id: "ai-2",
      type: "AI_AGENT",
      name: "Write personalized email",
      config: {
        modelProvider: "mock",
        modelName: "gpt-4o-mini",
        systemPrompt: leadEmailSystemPrompt,
        userPromptTemplate: leadEmailUserPromptTemplate,
        outputSchema: defaultLeadEmailOutputSchema,
        temperature: 0.5,
        retryLimit: 2
      }
    },
    { id: "approval-1", type: "HUMAN_APPROVAL", name: "Review email", config: {} },
    { id: "email-1", type: "EMAIL_MOCK", name: "Send email (mock)", config: {} },
    {
      id: "notify-1",
      type: "NOTIFICATION",
      name: "Create sales task",
      config: { title: "Call lead back within 24 hours" }
    },
    { id: "end-1", type: "END", name: "Done", config: {} }
  ],
  edges: [
    { id: "edge-1", source: "trigger-1", target: "ai-1" },
    { id: "edge-2", source: "ai-1", target: "condition-1" },
    { id: "edge-3", source: "condition-1", target: "ai-2", condition: "leadScore > 80" },
    { id: "edge-4", source: "condition-1", target: "end-1", condition: "else" },
    { id: "edge-5", source: "ai-2", target: "approval-1" },
    { id: "edge-6", source: "approval-1", target: "email-1" },
    { id: "edge-7", source: "email-1", target: "notify-1" },
    { id: "edge-8", source: "notify-1", target: "end-1" },
    // Rejecting the email skips it but keeps the hot lead: the sales task is still created.
    { id: "edge-9", source: "approval-1", target: "notify-1", condition: rejectedEdgeCondition }
  ]
};
