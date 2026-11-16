import { describe, expect, it, vi } from "vitest";
import { NonRetryableError } from "@agentops/events";
import { defaultLeadScoringOutputSchema, leadScoringSystemPrompt, leadScoringUserPromptTemplate } from "@agentops/shared";
import {
  AiOutputValidationError,
  createProvider,
  executeAgentTask,
  OpenAiResponsesProvider,
  type OpenAiResponsesClient
} from "./ai-task.executor";

const validJson = JSON.stringify({
  leadScore: 91,
  category: "high-intent",
  summary: "Shop wants chat automation and order tracking.",
  recommendedAction: "Send a personalized email and call within 24h.",
  confidence: 0.88
});

/** Fake OpenAI SDK: returns the queued responses in order; no network. */
function fakeOpenAi(responses: Array<{ output_text: string; usage?: { input_tokens?: number; output_tokens?: number } }>) {
  const create = vi.fn(async () => responses[Math.min(create.mock.calls.length - 1, responses.length - 1)]!);
  const client: OpenAiResponsesClient = { responses: { create } };
  return { client, create };
}

const config = {
  modelProvider: "openai",
  modelName: "gpt-4o-mini",
  systemPrompt: leadScoringSystemPrompt,
  userPromptTemplate: leadScoringUserPromptTemplate,
  outputSchema: defaultLeadScoringOutputSchema,
  retryLimit: 2
};
const lead = { name: "Anna", company: "Shop ABC", email: "anna@shopabc.vn", message: "Call me at +84 912 345 678", source: "form" };

describe("OpenAI Responses provider (fake SDK)", () => {
  it("fails clearly and without retries when OPENAI_API_KEY is missing", () => {
    expect(() => createProvider("openai", {})).toThrow("OPENAI_API_KEY is required");
    expect(() => createProvider("openai", {})).toThrow(NonRetryableError);
  });

  it("sends a strict JSON Schema request with masked PII and no server-side storage", async () => {
    const { client, create } = fakeOpenAi([{ output_text: validJson, usage: { input_tokens: 300, output_tokens: 60 } }]);

    const result = await executeAgentTask({ input: lead, config }, () => new OpenAiResponsesProvider({ client }));

    expect(result.output).toMatchObject({ leadScore: 91, category: "high-intent" });
    expect(result.tokenUsage).toEqual({ inputTokens: 300, outputTokens: 60 });
    const params = create.mock.calls[0]![0] as Record<string, any>;
    expect(params).toMatchObject({ model: "gpt-4o-mini", instructions: leadScoringSystemPrompt, store: false });
    expect(params.text.format).toMatchObject({ type: "json_schema", strict: true, schema: defaultLeadScoringOutputSchema });
    expect(params.input).toContain("an***@shopabc.vn");
    expect(params.input).not.toContain("anna@shopabc.vn");
    expect(params.input).toContain("[PHONE_REDACTED]");
  });

  it("retries invalid JSON and schema violations within retryLimit and sums every attempt's tokens", async () => {
    const { client, create } = fakeOpenAi([
      { output_text: "{not json", usage: { input_tokens: 100, output_tokens: 10 } },
      { output_text: JSON.stringify({ leadScore: 400 }), usage: { input_tokens: 100, output_tokens: 20 } },
      { output_text: validJson, usage: { input_tokens: 100, output_tokens: 30 } }
    ]);

    const result = await executeAgentTask({ input: lead, config }, () => new OpenAiResponsesProvider({ client }));

    expect(create).toHaveBeenCalledTimes(3);
    expect(result.attempts).toBe(3);
    expect(result.tokenUsage).toEqual({ inputTokens: 300, outputTokens: 60 });
  });

  it("gives up after retryLimit + 1 attempts with a non-retryable error carrying the spent tokens", async () => {
    const { client, create } = fakeOpenAi([{ output_text: "{}", usage: { input_tokens: 50, output_tokens: 5 } }]);

    const error = await executeAgentTask({ input: lead, config: { ...config, retryLimit: 1 } }, () => new OpenAiResponsesProvider({ client })).catch(
      (caught: unknown) => caught
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(AiOutputValidationError);
    expect(error).toBeInstanceOf(NonRetryableError);
    expect((error as AiOutputValidationError).tokenUsage).toEqual({ inputTokens: 100, outputTokens: 10 });
    expect((error as Error).message).toContain("after 2 attempt(s)");
  });
});
