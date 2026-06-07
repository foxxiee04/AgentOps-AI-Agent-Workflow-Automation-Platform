import Ajv, { type ErrorObject } from "ajv";
import { z } from "zod";

export type JsonSchema = Record<string, unknown>;
export type PromptMessages = {
  system: string;
  user: string;
  variables: Record<string, unknown>;
  safeInput: unknown;
};

export const aiProviderSchema = z.enum(["openai", "gemini", "mock"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const defaultLeadScoringOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["leadScore", "category", "summary", "recommendedAction", "personalizedEmail", "confidence"],
  properties: {
    leadScore: { type: "number", minimum: 0, maximum: 100 },
    category: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    recommendedAction: { type: "string", minLength: 1 },
    personalizedEmail: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const satisfies JsonSchema;

export const aiAgentNodeConfigSchema = z.object({
  modelProvider: aiProviderSchema.default("mock"),
  modelName: z.string().default("mock-lead-scorer"),
  systemPrompt: z.string().min(1).default("You are an operations assistant."),
  userPromptTemplate: z.string().min(1).default("Analyze this input and return structured JSON."),
  inputMapping: z.record(z.string(), z.string()).default({}),
  outputSchema: z.record(z.string(), z.unknown()).default(defaultLeadScoringOutputSchema),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().max(8000).default(1000),
  retryLimit: z.number().int().min(0).max(3).default(1),
  requireHumanApproval: z.boolean().default(false),
  savePromptAndOutput: z.boolean().default(false)
});
export type AiAgentNodeConfig = z.infer<typeof aiAgentNodeConfigSchema>;

export const leadScoreResultSchema = z.object({
  leadScore: z.number().min(0).max(100),
  category: z.string().min(1),
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  personalizedEmail: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.82)
});
export type LeadScoreResult = z.infer<typeof leadScoreResultSchema>;

export const aiEvaluationCaseSchema = z.object({
  id: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  expected: z.record(z.string(), z.unknown()).default({})
});
export type AiEvaluationCase = z.infer<typeof aiEvaluationCaseSchema>;

export const aiEvaluationResultSchema = z.object({
  caseId: z.string().min(1),
  passed: z.boolean(),
  expected: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  mismatches: z.array(z.string())
});
export type AiEvaluationResult = z.infer<typeof aiEvaluationResultSchema>;

export function maskSensitivePromptInput(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => maskSensitivePromptInput(item));
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : maskSensitivePromptInput(value)
      ])
    );
  }

  if (typeof input === "string") {
    return maskSensitiveString(input);
  }

  return input;
}

export function resolveMappedInput(input: Record<string, unknown>, inputMapping: Record<string, string>) {
  if (Object.keys(inputMapping).length === 0) {
    return input;
  }

  return Object.fromEntries(
    Object.entries(inputMapping).map(([variableName, sourcePath]) => [variableName, getValueAtPath(input, sourcePath)])
  );
}

export function renderPromptTemplate(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const value = getValueAtPath(variables, path);
    if (value === undefined || value === null) {
      return "";
    }

    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

export function buildAiPrompt(config: AiAgentNodeConfig, input: Record<string, unknown>): PromptMessages {
  const mappedInput = resolveMappedInput(input, config.inputMapping);
  const safeInput = maskSensitivePromptInput(mappedInput);
  const variables = safeInput && typeof safeInput === "object" && !Array.isArray(safeInput) ? safeInput : {};

  return {
    system: config.systemPrompt,
    user: renderPromptTemplate(config.userPromptTemplate, variables as Record<string, unknown>),
    variables: variables as Record<string, unknown>,
    safeInput
  };
}

export function validateAiOutput(outputSchema: JsonSchema, output: unknown) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(outputSchema);
  const valid = validate(output);

  return {
    valid,
    errors: valid ? [] : formatValidationErrors(validate.errors ?? [])
  };
}

export function evaluateAiOutput(output: Record<string, unknown>, expected: Record<string, unknown>): AiEvaluationResult["mismatches"] {
  return Object.entries(expected)
    .filter(([key, expectedValue]) => output[key] !== expectedValue)
    .map(([key, expectedValue]) => `${key}: expected ${JSON.stringify(expectedValue)}, received ${JSON.stringify(output[key])}`);
}

export function estimateTokenCount(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

function getValueAtPath(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, input);
}

function isSensitiveKey(key: string) {
  return /password|secret|token|api[-_]?key|authorization|refresh/i.test(key);
}

function maskSensitiveString(value: string) {
  return value
    .replace(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi, (_match, name: string, domain: string) => {
      return `${name.slice(0, 2)}***@${domain}`;
    })
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[PHONE_REDACTED]");
}

function formatValidationErrors(errors: ErrorObject[]) {
  return errors.map((error) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "failed validation"}`;
  });
}
