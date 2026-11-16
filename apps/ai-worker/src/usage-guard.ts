import { NonRetryableError } from "@agentops/events";
import type { PrismaClient } from "@agentops/database";
import { aiQuotaExceeded, describeAiQuota, resolveAiQuotaLimits, type AiQuotaLimits } from "@agentops/shared";

/** Enforces the workspace's daily AI budget before a provider call and records spend after it. */
export interface AiUsageGuard {
  assertWithinQuota(workspaceId: string): Promise<void>;
  record(workspaceId: string, workflowRunId: string, tokens: number): Promise<void>;
}

export class AiQuotaExceededError extends NonRetryableError {}

export class PrismaAiUsageGuard implements AiUsageGuard {
  constructor(
    private readonly prisma: Pick<PrismaClient, "usageRecord">,
    private readonly limits: AiQuotaLimits = resolveAiQuotaLimits(process.env)
  ) {}

  async assertWithinQuota(workspaceId: string) {
    const now = new Date();
    const records = await this.prisma.usageRecord.findMany({
      where: {
        workspaceId,
        aiTokensUsed: { gt: 0 },
        createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) }
      },
      select: { aiTokensUsed: true }
    });
    const usage = { calls: records.length, tokens: records.reduce((sum, record) => sum + record.aiTokensUsed, 0) };
    if (aiQuotaExceeded(usage, this.limits)) {
      throw new AiQuotaExceededError(describeAiQuota(usage, this.limits));
    }
  }

  async record(workspaceId: string, workflowRunId: string, tokens: number) {
    if (tokens <= 0) {
      return;
    }
    await this.prisma.usageRecord.create({ data: { workspaceId, workflowRunId, aiTokensUsed: tokens, workflowStepsExecuted: 1 } });
  }
}
