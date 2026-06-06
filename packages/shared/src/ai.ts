import { z } from "zod";

export const aiProviderSchema = z.enum(["openai", "gemini", "mock"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const aiAgentNodeConfigSchema = z.object({
  modelProvider: aiProviderSchema.default("mock"),
  modelName: z.string().default("mock-lead-scorer"),
  systemPrompt: z.string().min(1).default("You are an operations assistant."),
  userPromptTemplate: z.string().min(1).default("Analyze this input and return structured JSON."),
  inputMapping: z.record(z.string(), z.string()).default({}),
  outputSchema: z.record(z.string(), z.unknown()),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().max(8000).default(1000),
  requireHumanApproval: z.boolean().default(false),
  savePromptAndOutput: z.boolean().default(false)
});
export type AiAgentNodeConfig = z.infer<typeof aiAgentNodeConfigSchema>;

export const leadScoreResultSchema = z.object({
  leadScore: z.number().min(0).max(100),
  category: z.string().min(1),
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  personalizedEmail: z.string().min(1)
});
export type LeadScoreResult = z.infer<typeof leadScoreResultSchema>;

export function maskSensitivePromptInput(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }

  return JSON.parse(
    JSON.stringify(input).replace(
      /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
      (_match, name: string, domain: string) => `${name.slice(0, 2)}***@${domain}`
    )
  );
}

