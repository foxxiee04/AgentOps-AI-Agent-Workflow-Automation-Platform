import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import {
  aiAgentNodeConfigSchema,
  buildAiPrompt,
  buildMockLeadEmail,
  buildMockLeadScore,
  estimateTokenCount,
  validateAiOutput,
  type AiAgentNodeConfig,
  type AiProvider,
  type JsonSchema,
  type PromptMessages
} from "@agentops/shared";
import { NonRetryableError } from "@agentops/events";

export type ExecuteAgentTaskInput = {
  input: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type ExecuteAgentTaskResult = {
  output: Record<string, unknown>;
  provider: AiProvider;
  modelName: string;
  latencyMs: number;
  attempts: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  validation: {
    schemaValid: boolean;
    errors: string[];
  };
  prompt?: PromptMessages;
};

export type AiCompletionRequest = {
  config: AiAgentNodeConfig;
  prompt: PromptMessages;
};

/** Providers return either parsed `output` or raw `text`; the executor parses and validates it. */
export type AiCompletionResponse = {
  output?: Record<string, unknown>;
  text?: string;
  tokenUsage: ExecuteAgentTaskResult["tokenUsage"];
};

export interface AiProviderClient {
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

/** Output stayed invalid after every allowed attempt; carries the tokens already spent. */
export class AiOutputValidationError extends NonRetryableError {
  constructor(
    message: string,
    readonly attempts: number,
    readonly tokenUsage: ExecuteAgentTaskResult["tokenUsage"]
  ) {
    super(message);
  }
}

export async function executeAgentTask(
  { input, config: rawConfig }: ExecuteAgentTaskInput,
  providerFactory: (provider: AiProvider) => AiProviderClient = createProvider
) {
  const startedAt = Date.now();
  const config = aiAgentNodeConfigSchema.parse(rawConfig);
  const prompt = buildAiPrompt(config, input);
  const provider = providerFactory(config.modelProvider);
  const maxAttempts = config.retryLimit + 1;
  const tokenUsage = { inputTokens: 0, outputTokens: 0 };
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const completion = await provider.complete({ config, prompt });
    tokenUsage.inputTokens += completion.tokenUsage.inputTokens;
    tokenUsage.outputTokens += completion.tokenUsage.outputTokens;

    let output: unknown = completion.output;
    if (output === undefined) {
      try {
        output = JSON.parse(completion.text ?? "");
      } catch (error) {
        lastErrors = [`invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
        continue;
      }
    }

    const validation = validateAiOutput(config.outputSchema as JsonSchema, output);
    if (validation.valid) {
      return {
        output: output as Record<string, unknown>,
        provider: config.modelProvider,
        modelName: config.modelName,
        latencyMs: Date.now() - startedAt,
        tokenUsage,
        attempts: attempt,
        validation: { schemaValid: true, errors: [] },
        prompt: config.savePromptAndOutput ? prompt : undefined
      } satisfies ExecuteAgentTaskResult;
    }
    lastErrors = validation.errors;
  }

  throw new AiOutputValidationError(
    `AI output failed schema validation after ${maxAttempts} attempt(s): ${lastErrors.join("; ")}`,
    maxAttempts,
    tokenUsage
  );
}

export function createProvider(provider: AiProvider, env: Record<string, string | undefined> = process.env): AiProviderClient {
  if (provider === "openai") {
    return new OpenAiResponsesProvider({ apiKey: env["OPENAI_API_KEY"] });
  }

  return new MockAiProvider();
}

class MockAiProvider implements AiProviderClient {
  async complete({ config, prompt }: AiCompletionRequest): Promise<AiCompletionResponse> {
    const required = (config.outputSchema as { required?: unknown }).required;
    const output = Array.isArray(required) && required.includes("subject")
      ? buildMockLeadEmail(prompt.variables)
      : buildMockLeadScore(prompt.safeInput);

    return {
      output,
      tokenUsage: {
        inputTokens: estimateTokenCount([prompt.system, prompt.user]),
        outputTokens: estimateTokenCount(output)
      }
    };
  }
}

/** The slice of the OpenAI SDK the provider uses, so tests can pass a fake client. */
export type OpenAiResponsesClient = {
  responses: { create(params: ResponseCreateParamsNonStreaming): Promise<{ output_text: string; usage?: { input_tokens?: number; output_tokens?: number } | null }> };
};

export class OpenAiResponsesProvider implements AiProviderClient {
  private readonly client: OpenAiResponsesClient;

  constructor(options: { apiKey?: string; client?: OpenAiResponsesClient } = {}) {
    if (options.client) {
      this.client = options.client;
      return;
    }
    if (!options.apiKey) {
      throw new NonRetryableError("OPENAI_API_KEY is required when modelProvider is openai");
    }

    this.client = new OpenAI({ apiKey: options.apiKey, maxRetries: 2, timeout: 30_000 }) as unknown as OpenAiResponsesClient;
  }

  async complete({ config, prompt }: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.client.responses.create({
      model: config.modelName,
      instructions: config.systemPrompt,
      input: prompt.user,
      temperature: config.temperature,
      max_output_tokens: config.maxTokens,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "agentops_ai_node_output",
          description: "Validated output for an AgentOps AI workflow node.",
          schema: config.outputSchema,
          strict: true
        }
      }
    } satisfies ResponseCreateParamsNonStreaming);

    return {
      text: response.output_text,
      tokenUsage: {
        inputTokens: response.usage?.input_tokens ?? estimateTokenCount([prompt.system, prompt.user]),
        outputTokens: response.usage?.output_tokens ?? estimateTokenCount(response.output_text)
      }
    };
  }
}
