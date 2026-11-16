import { z, type ZodError } from "zod";
import { leadScoringSystemPrompt } from "./ai";
import type { WorkflowDefinition } from "./workflow";

/**
 * Trigger payload every lead workflow expects (webhook form, load test, "Run" button).
 * Unknown fields are passed through so a workflow can read extra context.
 */
export const leadInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().min(1).max(254).email(),
    message: z.string().trim().min(1).max(5000),
    company: z.string().trim().max(200).optional(),
    source: z.string().trim().max(100).optional()
  })
  .passthrough();

export type LeadInput = z.infer<typeof leadInputSchema>;

/**
 * Lead workflows are detected from the graph itself, so no extra flag is needed on stored
 * workflows: either the trigger declares `inputSchema: "lead"`, or an AI node scores leads.
 */
export function requiresLeadInput(definition: WorkflowDefinition): boolean {
  return definition.nodes.some(
    (node) =>
      (node.type === "TRIGGER" && node.config.inputSchema === "lead") ||
      (node.type === "AI_AGENT" && node.config.systemPrompt === leadScoringSystemPrompt)
  );
}

/** Field path -> first validation message, ready to be sent back as error details. */
export function formatLeadInputErrors(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.map((segment) => String(segment)).join(".") || "_";
    if (!(path in details)) {
      details[path] = issue.message;
    }
  }

  return details;
}
