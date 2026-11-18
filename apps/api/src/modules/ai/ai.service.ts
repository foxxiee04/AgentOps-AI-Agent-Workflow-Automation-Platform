import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  aiAgentNodeConfigSchema,
  aiQuotaExceeded,
  describeAiQuota,
  hasRoleAtLeast,
  resolveAiQuotaLimits,
  buildAiPrompt,
  buildMockLeadEmail,
  buildMockLeadScore,
  defaultLeadScoringOutputSchema,
  estimateTokenCount,
  leadEvaluationCases,
  estimateAiCostUsd,
  evaluateAiOutput,
  evaluateLeadClassification,
  leadGoldenSetVersion,
  type EvaluatedCase,
  type WorkspaceRole,
  leadScoreResultSchema,
  validateAiOutput,
  type AiAgentNodeConfig,
  type JsonSchema
} from "@agentops/shared";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { DemoDataService, demoWorkspaceId } from "../../common/infrastructure/demo-data.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import type { EvaluateAgentDto, TestAgentDto } from "./dto";

@Injectable()
export class AiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoDataService) private readonly demoData: DemoDataService
  ) {}

  async testAgent(dto: TestAgentDto) {
    await this.assertWithinQuota();
    const result = this.runMockAgent(dto.input, this.resolveConfig(dto.config, dto.modelProvider));
    await this.recordUsage(result.tokenUsage.inputTokens + result.tokenUsage.outputTokens);
    return result;
  }

  async evaluateAgent(dto: EvaluateAgentDto) {
    await this.assertWithinQuota();
    const config = this.resolveConfig(dto.config);
    const testCases = dto.testCases ?? leadEvaluationCases;
    const evaluated: EvaluatedCase[] = [];
    const results = testCases.map((testCase) => {
      const startedAt = Date.now();
      const execution = this.runMockAgent(testCase.input, config);
      const expected = testCase.expected ?? {};
      // Golden-set labels include the expected branch; derive it the way the workflow does (leadScore > 80).
      const leadScore = typeof execution.result["leadScore"] === "number" ? (execution.result["leadScore"] as number) : undefined;
      const comparable = leadScore === undefined ? execution.result : { ...execution.result, branch: leadScore > 80 ? "A" : "B" };
      const mismatches = evaluateAiOutput(comparable, expected);
      evaluated.push({
        caseId: testCase.id,
        expected: { category: String(expected["category"] ?? ""), branch: expected["branch"] as "A" | "B" | undefined },
        output: { category: execution.result["category"] as string | undefined, leadScore },
        schemaValid: execution.validation.schemaValid,
        latencyMs: Date.now() - startedAt,
        inputTokens: execution.tokenUsage.inputTokens,
        outputTokens: execution.tokenUsage.outputTokens,
        costUsd: estimateAiCostUsd(config.modelProvider, config.modelName, execution.tokenUsage.inputTokens, execution.tokenUsage.outputTokens)
      });

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
    await this.recordUsage(results.reduce((sum, r) => sum + r.tokenUsage.inputTokens + r.tokenUsage.outputTokens, 0));

    return {
      provider: config.modelProvider,
      modelName: config.modelName,
      goldenSetVersion: dto.testCases ? undefined : leadGoldenSetVersion,
      totalCases: results.length,
      passed,
      failed: results.length - passed,
      passRate: results.length === 0 ? 0 : Number((passed / results.length).toFixed(2)),
      // Accuracy, per-class precision/recall/F1, confusion matrix, branch accuracy, hot-lead miss rate, latency, cost.
      report: evaluateLeadClassification(evaluated),
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

  async usage() {
    await this.demoData.ensureDemoWorkspace();
    const records = await this.prisma.client.usageRecord.findMany({
      where: {
        workspaceId: demoWorkspaceId,
        createdAt: {
          gte: this.startOfUtcDay()
        }
      }
    });
    const tokensUsedToday = records.reduce((sum, record) => sum + record.aiTokensUsed, 0);

    return {
      workspaceId: demoWorkspaceId,
      dailyAiCallLimit: this.limits().calls,
      dailyAiTokenLimit: this.limits().tokens,
      aiCallsToday: records.filter((record) => record.aiTokensUsed > 0).length,
      tokensUsedToday,
      notes: "Counts AI calls from the ai-worker and the API test endpoints (UsageRecord). Limits: AI_DAILY_CALL_LIMIT, AI_DAILY_TOKEN_LIMIT."
    };
  }

  async getTask(id: string, auth?: AuthenticatedCaller) {
    const task = await this.prisma.client.aiTaskResult.findUnique({
      where: { id }
    });

    if (!task) {
      throw new NotFoundException("AI task not found");
    }

    if (!auth?.userId) {
      throw new ForbiddenException("Workspace membership required");
    }

    const membership = await this.prisma.client.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: task.workspaceId,
          userId: auth.userId
        }
      }
    });

    if (!membership || !hasRoleAtLeast(membership.role as WorkspaceRole, "VIEWER")) {
      throw new ForbiddenException("Workspace membership required");
    }

    return {
      id: task.id,
      workflowRunId: task.workflowRunId,
      nodeId: task.nodeId,
      provider: task.provider,
      modelName: task.modelName,
      inputTokens: task.inputTokens,
      outputTokens: task.outputTokens,
      output: (task.outputJson ?? null) as unknown,
      errorMessage: task.errorMessage ?? null,
      createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : String(task.createdAt)
    };
  }

  private runMockAgent(input: Record<string, unknown>, config: AiAgentNodeConfig) {
    const prompt = buildAiPrompt(config, input);
    const required = (config.outputSchema as { required?: unknown }).required;
    const result = Array.isArray(required) && required.includes("subject")
      ? buildMockLeadEmail(prompt.variables)
      : leadScoreResultSchema.parse(buildMockLeadScore(prompt.safeInput));
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

  private limits() {
    return resolveAiQuotaLimits(process.env);
  }

  /** Rejects the request with HTTP 429 once the workspace used its daily AI call or token budget. */
  private async assertWithinQuota() {
    const usage = await this.usage();
    const limits = this.limits();
    const today = { calls: usage.aiCallsToday, tokens: usage.tokensUsedToday };
    if (aiQuotaExceeded(today, limits)) {
      throw new HttpException(describeAiQuota(today, limits), HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async recordUsage(aiTokensUsed: number) {
    await this.demoData.ensureDemoWorkspace();
    await this.prisma.client.usageRecord.create({
      data: {
        workspaceId: demoWorkspaceId,
        aiTokensUsed,
        workflowStepsExecuted: 0
      }
    });
  }

  private startOfUtcDay() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
