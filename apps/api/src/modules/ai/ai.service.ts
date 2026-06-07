import { Injectable } from "@nestjs/common";
import {
  aiAgentNodeConfigSchema,
  buildAiPrompt,
  defaultLeadScoringOutputSchema,
  estimateTokenCount,
  evaluateAiOutput,
  leadScoreResultSchema,
  validateAiOutput,
  type AiAgentNodeConfig,
  type JsonSchema
} from "@agentops/shared";
import type { EvaluateAgentDto, TestAgentDto } from "./dto";

@Injectable()
export class AiService {
  testAgent(dto: TestAgentDto) {
    return this.runMockAgent(dto.input, this.resolveConfig(dto.config, dto.modelProvider));
  }

  evaluateAgent(dto: EvaluateAgentDto) {
    const config = this.resolveConfig(dto.config);
    const results = dto.testCases.map((testCase) => {
      const execution = this.runMockAgent(testCase.input, config);
      const expected = testCase.expected ?? {};
      const mismatches = evaluateAiOutput(execution.result, expected);

      return {
        caseId: testCase.id,
        passed: mismatches.length === 0 && execution.validation.schemaValid,
        expected,
        output: execution.result,
        mismatches,
        tokenUsage: execution.tokenUsage,
        validation: execution.validation
      };
    });
    const passed = results.filter((result) => result.passed).length;

    return {
      provider: config.modelProvider,
      modelName: config.modelName,
      totalCases: results.length,
      passed,
      failed: results.length - passed,
      passRate: results.length === 0 ? 0 : Number((passed / results.length).toFixed(2)),
      results
    };
  }

  providers() {
    return {
      defaultProvider: "mock",
      providers: [
        {
          id: "mock",
          status: "ready",
          defaultModel: "mock-lead-scorer",
          supportsStructuredOutput: true
        },
        {
          id: "openai",
          status: process.env.OPENAI_API_KEY ? "configured" : "missing_api_key",
          defaultModel: "gpt-4o-mini",
          supportsStructuredOutput: true
        },
        {
          id: "gemini",
          status: "planned",
          defaultModel: "gemini-placeholder",
          supportsStructuredOutput: true
        }
      ]
    };
  }

  usage() {
    return {
      workspaceId: "ws_demo",
      dailyAiCallLimit: 100,
      aiCallsToday: 1,
      tokensUsedToday: 0,
      notes: "MVP mock usage. Persist real usage per workspace when AI worker writes AiTaskResult records."
    };
  }

  private runMockAgent(input: Record<string, unknown>, config: AiAgentNodeConfig) {
    const prompt = buildAiPrompt(config, input);
    const result = leadScoreResultSchema.parse({
      leadScore: this.inferLeadScore(prompt.safeInput),
      category: this.inferLeadScore(prompt.safeInput) >= 80 ? "high-intent" : "medium-intent",
      summary: "The lead appears interested in automating sales and support workflows.",
      recommendedAction: "Send a personalized follow-up email and create a sales task.",
      personalizedEmail: "Hi there, thanks for reaching out about workflow automation. I would love to learn more.",
      confidence: this.inferLeadScore(prompt.safeInput) >= 80 ? 0.91 : 0.72
    });
    const validation = validateAiOutput(config.outputSchema as JsonSchema, result);

    return {
      provider: config.modelProvider,
      modelName: config.modelName,
      safeInput: prompt.safeInput,
      promptPreview: {
        system: prompt.system,
        user: prompt.user
      },
      outputSchema: config.outputSchema,
      result,
      validation: {
        schemaValid: validation.valid,
        errors: validation.errors
      },
      tokenUsage: {
        inputTokens: estimateTokenCount([prompt.system, prompt.user]),
        outputTokens: estimateTokenCount(result)
      },
      guardrails: {
        promptAndOutputStorage: config.savePromptAndOutput ? "enabled" : "disabled",
        requireHumanApproval: config.requireHumanApproval
      }
    };
  }

  private resolveConfig(rawConfig: Record<string, unknown> | undefined, modelProvider?: string): AiAgentNodeConfig {
    return aiAgentNodeConfigSchema.parse({
      outputSchema: defaultLeadScoringOutputSchema,
      ...(rawConfig ?? {}),
      ...(modelProvider ? { modelProvider } : {})
    });
  }

  private inferLeadScore(input: unknown): number {
    const text = JSON.stringify(input).toLowerCase();
    if (text.includes("urgent") || text.includes("automation") || text.includes("sales")) {
      return 87;
    }
    return 62;
  }
}
