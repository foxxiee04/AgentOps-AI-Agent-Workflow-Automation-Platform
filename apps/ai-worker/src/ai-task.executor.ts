import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import {
  aiAgentNodeConfigSchema,
  buildAiPrompt,
  estimateTokenCount,
  leadScoreResultSchema,
  validateAiOutput,
  type AiAgentNodeConfig,
  type AiProvider,
  type JsonSchema,
  type PromptMessages
} from "@agentops/shared";

export type ExecuteAgentTaskInput = {
  input: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type ExecuteAgentTaskResult = {
  output: Record<string, unknown>;
  provider: AiProvider;
  modelName: string;
  latencyMs: number;
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

type AiCompletionRequest = {
  config: AiAgentNodeConfig;
  prompt: PromptMessages;
};

type AiCompletionResponse = {
  output: Record<string, unknown>;
  tokenUsage: ExecuteAgentTaskResult["tokenUsage"];
};

interface AiProviderClient {
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

export async function executeAgentTask({ input, config: rawConfig }: ExecuteAgentTaskInput) {
  const startedAt = Date.now();
  const config = aiAgentNodeConfigSchema.parse(rawConfig);
  const prompt = buildAiPrompt(config, input);
  const provider = createProvider(config.modelProvider);
  const completion = await provider.complete({ config, prompt });
  const validation = validateAiOutput(config.outputSchema as JsonSchema, completion.output);

  if (!validation.valid) {
    throw new Error(`AI output failed schema validation: ${validation.errors.join("; ")}`);
  }

  return {
    output: completion.output,
    provider: config.modelProvider,
    modelName: config.modelName,
    latencyMs: Date.now() - startedAt,
    tokenUsage: completion.tokenUsage,
    validation: {
      schemaValid: true,
      errors: []
    },
    prompt: config.savePromptAndOutput ? prompt : undefined
  } satisfies ExecuteAgentTaskResult;
}

function createProvider(provider: AiProvider): AiProviderClient {
  if (provider === "openai") {
    return new OpenAiResponsesProvider();
  }

  return new MockAiProvider();
}

class MockAiProvider implements AiProviderClient {
  async complete({ prompt }: AiCompletionRequest): Promise<AiCompletionResponse> {
    const output = leadScoreResultSchema.parse({
      leadScore: inferLeadScore(prompt.safeInput),
      category: inferLeadScore(prompt.safeInput) >= 80 ? "high-intent" : "medium-intent",
      summary: "The lead is interested in workflow automation and AI-supported operations.",
      recommendedAction: "Create a sales follow-up task and send a concise personalized email.",
      personalizedEmail:
        "Hi, thanks for sharing your automation needs. AgentOps can help qualify leads and trigger follow-up workflows.",
      confidence: inferLeadScore(prompt.safeInput) >= 80 ? 0.91 : 0.72
    });

    return {
      output,
      tokenUsage: {
        inputTokens: estimateTokenCount([prompt.system, prompt.user]),
        outputTokens: estimateTokenCount(output)
      }
    };
  }
}

class OpenAiResponsesProvider implements AiProviderClient {
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when modelProvider is openai");
    }

    this.client = new OpenAI({ apiKey });
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
      output: JSON.parse(response.output_text) as Record<string, unknown>,
      tokenUsage: {
        inputTokens: response.usage?.input_tokens ?? estimateTokenCount([prompt.system, prompt.user]),
        outputTokens: response.usage?.output_tokens ?? estimateTokenCount(response.output_text)
      }
    };
  }
}

function inferLeadScore(input: unknown): number {
  const text = JSON.stringify(input).toLowerCase();
  if (text.includes("urgent") || text.includes("automation") || text.includes("sales")) {
    return 87;
  }
  return 62;
}
