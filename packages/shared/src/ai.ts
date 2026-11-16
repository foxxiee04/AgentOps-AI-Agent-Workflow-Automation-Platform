import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
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
  required: ["leadScore", "category", "summary", "recommendedAction", "confidence"],
  properties: {
    leadScore: { type: "number", minimum: 0, maximum: 100 },
    category: { type: "string", enum: ["high-intent", "low-intent", "spam"] },
    summary: { type: "string", minLength: 1 },
    recommendedAction: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const satisfies JsonSchema;

export const defaultLeadEmailOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: { type: "string", minLength: 1 },
    body: { type: "string", minLength: 1 }
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
  category: z.enum(["high-intent", "low-intent", "spam"]),
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.82)
});
export type LeadScoreResult = z.infer<typeof leadScoreResultSchema>;

export const leadEmailResultSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1)
});
export type LeadEmailResult = z.infer<typeof leadEmailResultSchema>;

export const leadScoringSystemPrompt =
  "You are a sales operations assistant that qualifies inbound leads. Classify each lead into exactly one category: high-intent, low-intent, or spam. " +
  "Use high-intent when the lead expresses a concrete need for automation, names a real company, and makes a specific request. " +
  "Use low-intent when the message is vague, exploratory, or the sender is merely curious. " +
  "Use spam when the message is irrelevant, gibberish, or purely promotional. " +
  "Return only JSON that matches the provided output schema.";

export const leadScoringUserPromptTemplate =
  "Qualify the following lead.\n" +
  "Name: {{name}}\n" +
  "Company: {{company}}\n" +
  "Email: {{email}}\n" +
  "Message: {{message}}\n" +
  "Source: {{source}}\n" +
  "Return a JSON object with leadScore (0-100), category (high-intent | low-intent | spam), summary, recommendedAction, and confidence (0-1).";

export const leadEmailSystemPrompt =
  "You are a sales operations assistant that writes concise, personalized follow-up emails to inbound leads. " +
  "Return only JSON that matches the provided output schema with a subject and a body. " +
  "Keep the tone professional, specific, and focused on the recommended next action.";

export const leadEmailUserPromptTemplate =
  "Write a follow-up email for the following lead.\n" +
  "Name: {{name}}\n" +
  "Company: {{company}}\n" +
  "Summary: {{summary}}\n" +
  "Recommended action: {{recommendedAction}}\n" +
  "Return a JSON object with subject and body.";

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

const outputSchemaAjv = new Ajv({ allErrors: true, strict: false });
const validatorsBySchema = new WeakMap<JsonSchema, ValidateFunction>();
const validatorsByKey = new Map<string, ValidateFunction>();

function getOutputValidator(outputSchema: JsonSchema): ValidateFunction {
  const cached = validatorsBySchema.get(outputSchema);
  if (cached) {
    return cached;
  }

  const key = JSON.stringify(outputSchema);
  let validate = validatorsByKey.get(key);
  if (!validate) {
    try {
      validate = outputSchemaAjv.compile(outputSchema);
    } finally {
      // Unregister so unrelated user schemas that reuse the same $id never collide.
      outputSchemaAjv.removeSchema(outputSchema);
    }
    validatorsByKey.set(key, validate);
  }

  validatorsBySchema.set(outputSchema, validate);
  return validate;
}

/** Validates AI output against a JSON Schema; schemas are treated as immutable and compiled once. */
export function validateAiOutput(outputSchema: JsonSchema, output: unknown) {
  const validate = getOutputValidator(outputSchema);
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

/**
 * Patterns that indicate a lead message is trying to steer the scoring model
 * rather than describe a genuine request. Kept case-insensitive and conservative
 * so ordinary messages (including ones that mention "ignore" or "rules") do not trip it.
 */
const promptInjectionPatterns: RegExp[] = [
  /ignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above)\s+(?:instructions|prompts?)/i,
  /disregard\s+(?:your|the|all)\s+(?:rules|instructions)/i,
  /^\s*system\s*:/im,
  /you are now/i,
  /(?:output|return|set|give)[^.]{0,40}(?:lead ?score|score|category)[^.]{0,20}(?:\d{2,3}|high-intent)/i,
  /bỏ qua\s+(?:mọi\s+|các\s+)?(?:hướng dẫn|chỉ dẫn)/i
];

export function detectPromptInjection(text: string): boolean {
  return promptInjectionPatterns.some((pattern) => pattern.test(text));
}

/**
 * Neutralizes a lead-scoring output whose input tried to manipulate the prompt.
 * Only existing output keys are overwritten so the output stays schema-valid.
 */
export function applyLeadScoringGuardrail(
  output: Record<string, unknown>,
  input: Record<string, unknown>
): { output: Record<string, unknown>; triggered: boolean } {
  const shallowValues = ["name", "company", "message", "source"]
    .map((key) => input[key])
    .filter((value): value is string => typeof value === "string");

  if (!shallowValues.some((value) => detectPromptInjection(value))) {
    return { output, triggered: false };
  }

  const guarded = { ...output };
  if ("category" in guarded) {
    guarded["category"] = "spam";
  }
  if ("leadScore" in guarded) {
    guarded["leadScore"] = Math.min(Number(guarded["leadScore"]) || 0, 5);
  }
  if ("recommendedAction" in guarded) {
    guarded["recommendedAction"] = "Discard: the message tries to manipulate the scoring prompt.";
  }

  return { output: guarded, triggered: true };
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

export type AiQuotaLimits = { calls: number; tokens: number };
export type AiUsageToday = { calls: number; tokens: number };

/** Daily per-workspace AI budget shared by the API test endpoints and the ai-worker. */
export function resolveAiQuotaLimits(env: Record<string, string | undefined>): AiQuotaLimits {
  return {
    calls: Number(env["AI_DAILY_CALL_LIMIT"]) || 100,
    tokens: Number(env["AI_DAILY_TOKEN_LIMIT"]) || 200000
  };
}

export function aiQuotaExceeded(usage: AiUsageToday, limits: AiQuotaLimits): boolean {
  return usage.calls >= limits.calls || usage.tokens >= limits.tokens;
}

export function describeAiQuota(usage: AiUsageToday, limits: AiQuotaLimits): string {
  return `Daily AI quota reached (${usage.calls}/${limits.calls} calls, ${usage.tokens}/${limits.tokens} tokens).`;
}

/**
 * USD per 1M tokens used for the cost *estimate* metric. Update when OpenAI prices change;
 * unknown models (and the mock provider) are estimated at 0.
 */
export const aiModelPricingPerMillion: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 }
};

export function estimateAiCostUsd(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  if (provider === "mock") {
    return 0;
  }
  const price = aiModelPricingPerMillion[model];
  if (!price) {
    return 0;
  }
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
