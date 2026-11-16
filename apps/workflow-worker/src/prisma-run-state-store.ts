import type { PrismaClient } from "@agentops/database";
import type { RunStateChange } from "./run-state";

const activeRunStatuses = ["PENDING", "RUNNING", "WAITING_APPROVAL"] as const;

export interface RunStateStore {
  apply(change: RunStateChange): Promise<void>;
}

/**
 * Writes run state in one transaction. Every write is an upsert or a guarded update, so replaying
 * the same message (at-least-once delivery) leaves the database unchanged.
 */
export class PrismaRunStateStore implements RunStateStore {
  constructor(private readonly prisma: PrismaClient) {}

  async apply(change: RunStateChange): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.workflowRun.findUnique({
        where: { id: change.workflowRunId },
        include: { workflowVersion: { select: { definitionJson: true } } }
      });
      if (!run) {
        throw new Error(`Workflow run ${change.workflowRunId} not found`);
      }

      const definition = run.workflowVersion.definitionJson as { nodes?: Array<{ id: string; type: string }> };
      const nodeTypes = new Map((definition.nodes ?? []).map((node) => [node.id, node.type]));

      for (const step of change.steps) {
        const nodeType = nodeTypes.get(step.nodeId);
        if (!nodeType) {
          continue;
        }
        const data = {
          status: step.status,
          ...(step.input !== undefined ? { inputJson: json(step.input) } : {}),
          ...(step.output !== undefined ? { outputJson: json(step.output) } : {}),
          ...(step.errorMessage !== undefined ? { errorMessage: step.errorMessage } : {}),
          ...(step.started ? { startedAt: now } : {}),
          ...(step.finished ? { finishedAt: now } : {})
        };
        await tx.workflowStepRun.upsert({
          where: { workflowRunId_nodeId: { workflowRunId: run.id, nodeId: step.nodeId } },
          update: data,
          create: { id: `${run.id}_${step.nodeId}`, workflowRunId: run.id, nodeId: step.nodeId, nodeType: nodeType as never, ...data }
        });
      }

      for (const approval of change.approvals) {
        await tx.humanApproval.upsert({
          where: { workflowRunId_nodeId: { workflowRunId: run.id, nodeId: approval.nodeId } },
          update: {},
          create: { workspaceId: run.workspaceId, workflowRunId: run.id, nodeId: approval.nodeId, payloadJson: json(approval.review) }
        });
      }

      if (change.aiResult) {
        const id = `ai_${run.id}_${change.aiResult.nodeId}`;
        await tx.aiTaskResult.upsert({
          where: { id },
          update: {},
          create: {
            id,
            workspaceId: run.workspaceId,
            workflowRunId: run.id,
            nodeId: change.aiResult.nodeId,
            provider: change.aiResult.provider,
            modelName: change.aiResult.modelName,
            outputJson: json(change.aiResult.output),
            inputTokens: change.aiResult.inputTokens,
            outputTokens: change.aiResult.outputTokens
          }
        });
      }

      if (change.toolResult) {
        const id = `tool_${run.id}_${change.toolResult.nodeId}`;
        await tx.toolCallResult.upsert({
          where: { id },
          update: {},
          create: {
            id,
            workspaceId: run.workspaceId,
            workflowRunId: run.id,
            nodeId: change.toolResult.nodeId,
            toolType: change.toolResult.toolType,
            status: change.toolResult.status,
            outputJson: json(change.toolResult.output)
          }
        });
      }

      // Terminal runs (e.g. cancelled by a reviewer through the API) are never moved back.
      const finished = change.runStatus === "COMPLETED" || change.runStatus === "FAILED" || change.runStatus === "CANCELLED";
      await tx.workflowRun.updateMany({
        where: { id: run.id, status: { in: [...activeRunStatuses] } },
        data: {
          status: change.runStatus,
          ...(run.startedAt ? {} : { startedAt: now }),
          ...(finished ? { finishedAt: now } : {}),
          ...(change.errorMessage ? { errorMessage: change.errorMessage } : {}),
          ...(change.context ? { contextJson: json(change.context) } : {})
        }
      });

      if (change.skipPending) {
        await tx.workflowStepRun.updateMany({
          where: { workflowRunId: run.id, status: "PENDING" },
          data: { status: "SKIPPED" }
        });
      }
    });
  }
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null)) as never;
}
