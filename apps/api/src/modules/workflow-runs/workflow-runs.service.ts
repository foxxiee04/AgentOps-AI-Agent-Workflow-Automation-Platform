import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { kafkaTopics } from "@agentops/events";
import { Prisma } from "@agentops/database";
import { editedEmailSchema, hasRoleAtLeast, hasRejectedPath, workflowDefinitionSchema, type WorkspaceRole } from "@agentops/shared";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { approvalDecisionsTotal } from "../../common/metrics/api-metrics";
import { AuthService } from "../auth/auth.service";
import type { ApprovalDecisionDto } from "./dto";

/** Lowest workspace role allowed to approve or reject outbound actions (VIEWER cannot). */
export const approvalMinimumRole: WorkspaceRole = "MEMBER";

type ApprovalRecord = {
  id: string;
  workspaceId: string;
  workflowRunId: string;
  nodeId: string;
  status: string;
  payloadJson: unknown;
  decidedById: string | null;
  comment: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
};

@Injectable()
export class WorkflowRunsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DomainEventsService) private readonly events: DomainEventsService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  /**
   * Records a reviewer decision exactly once. Approve publishes `human-approval-decided` so the
   * workflow-worker continues; reject cancels the run immediately and publishes the same event
   * for the audit trail. A second decision returns 409 with the first one.
   *
   * A workflow with a `rejected` edge on the approval node keeps the hot lead: the run continues
   * through that edge (the email is skipped, the sales task is still created) instead of being
   * cancelled. Workflows without such an edge keep the old behaviour: the run is cancelled.
   */
  async decideApproval(runId: string, stepId: string, dto: ApprovalDecisionDto, authorization?: string) {
    const caller = await this.auth.authenticate(authorization);
    const run = await this.prisma.client.workflowRun.findUnique({
      where: { id: runId },
      include: { workflowVersion: { select: { definitionJson: true } } }
    });
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }

    await this.assertCanDecide(run.workspaceId, caller.userId);

    const nodeId = stepId.startsWith(`${run.id}_`) ? stepId.slice(run.id.length + 1) : stepId;
    const approval = await this.prisma.client.humanApproval.findUnique({
      where: { workflowRunId_nodeId: { workflowRunId: run.id, nodeId } }
    });
    if (!approval) {
      throw new NotFoundException("No approval was requested for this step");
    }
    if (approval.status !== "WAITING_APPROVAL") {
      throw this.alreadyDecided(approval);
    }

    const definition = workflowDefinitionSchema.parse(run.workflowVersion.definitionJson);
    const approved = dto.decision === "approve";
    // An edited email only makes sense when approving.
    const editedEmail = approved ? this.parseEditedEmail(dto.editedEmail) : undefined;
    const continuesOnReject = !approved && hasRejectedPath(definition, nodeId);
    const decidedAt = new Date();
    const review = (approval.payloadJson ?? {}) as Record<string, unknown>;
    const payloadJson = editedEmail ? ({ ...review, editedEmail } as Prisma.InputJsonValue) : undefined;
    const decided = await this.prisma.client.$transaction(async (tx) => {
      // Guarded update: only one concurrent request can move the approval out of WAITING_APPROVAL.
      const updated = await tx.humanApproval.updateMany({
        where: { id: approval.id, status: "WAITING_APPROVAL" },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          decidedById: caller.userId,
          comment: dto.comment,
          decidedAt,
          ...(payloadJson ? { payloadJson } : {})
        }
      });
      if (updated.count === 0) {
        return undefined;
      }

      if (!approved) {
        if (continuesOnReject) {
          // The worker continues the run through the `rejected` edge; the email stays pending (skipped).
          await tx.workflowStepRun.updateMany({
            where: { workflowRunId: run.id, nodeId },
            data: {
              status: "COMPLETED",
              outputJson: { decision: "reject", decidedBy: caller.userId, comment: dto.comment ?? null },
              finishedAt: decidedAt
            }
          });
          await tx.workflowRun.updateMany({
            where: { id: run.id, status: { in: ["PENDING", "RUNNING", "WAITING_APPROVAL"] } },
            data: { status: "RUNNING" }
          });
        } else {
          await tx.workflowStepRun.updateMany({
            where: { workflowRunId: run.id, nodeId },
            data: {
              status: "FAILED",
              errorMessage: `Rejected by reviewer${dto.comment ? `: ${dto.comment}` : ""}`,
              outputJson: { decision: "reject", decidedBy: caller.userId, comment: dto.comment ?? null },
              finishedAt: decidedAt
            }
          });
          await tx.workflowStepRun.updateMany({ where: { workflowRunId: run.id, status: "PENDING" }, data: { status: "SKIPPED" } });
          await tx.workflowRun.updateMany({
            where: { id: run.id, status: { in: ["PENDING", "RUNNING", "WAITING_APPROVAL"] } },
            data: { status: "CANCELLED", errorMessage: "Email rejected by reviewer", finishedAt: decidedAt }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          workspaceId: run.workspaceId,
          actorUserId: caller.userId,
          action: approved ? "workflow_run.approval.approved" : "workflow_run.approval.rejected",
          entityType: "workflow_step",
          entityId: `${run.id}_${nodeId}`,
          metadataJson: { workflowRunId: run.id, nodeId, comment: dto.comment ?? null }
        }
      });

      return tx.humanApproval.findUniqueOrThrow({ where: { id: approval.id } });
    });

    if (!decided) {
      const current = await this.prisma.client.humanApproval.findUniqueOrThrow({ where: { id: approval.id } });
      throw this.alreadyDecided(current);
    }

    approvalDecisionsTotal.inc({ decision: dto.decision });

    const event = await this.events.publish({
      type: kafkaTopics.humanApprovalDecided,
      workspaceId: run.workspaceId,
      workflowId: run.workflowId,
      workflowRunId: run.id,
      payload: {
        nodeId,
        decision: dto.decision,
        comment: dto.comment,
        ...(editedEmail ? { editedEmail } : {}),
        decidedBy: caller.userId,
        definition,
        context: (run.contextJson ?? {}) as Record<string, unknown>
      }
    });

    return { approval: this.toApprovalView(decided), eventId: event.eventId };
  }

  /** Approvals for the review screen; payload is the masked review content written by the worker. */
  async listApprovals(workspaceId: string | undefined, status: string | undefined, userId: string) {
    const resolvedStatus = status ?? "WAITING_APPROVAL";
    const approvals = await this.prisma.client.humanApproval.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        ...(resolvedStatus === "ALL" ? {} : { status: resolvedStatus as never }),
        workflowRun: { workspace: { members: { some: { userId } } } }
      },
      orderBy: { requestedAt: "desc" },
      take: 100
    });
    return approvals.map((approval) => this.toApprovalView(approval));
  }

  /** The reviewer's edited email, when it is well formed. */
  private parseEditedEmail(value: unknown) {
    if (value === undefined || value === null) {
      return undefined;
    }
    const parsed = editedEmailSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }

  private async assertCanDecide(workspaceId: string, userId: string) {
    const membership = await this.prisma.client.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    if (!membership || !hasRoleAtLeast(membership.role as WorkspaceRole, approvalMinimumRole)) {
      throw new ForbiddenException(`Approving requires the ${approvalMinimumRole} role or higher in this workspace`);
    }
  }

  private alreadyDecided(approval: ApprovalRecord) {
    return new ConflictException({
      message: `This step was already ${approval.status === "APPROVED" ? "approved" : "rejected"}`,
      details: this.toApprovalView(approval)
    });
  }

  private toApprovalView(approval: ApprovalRecord) {
    return {
      id: approval.id,
      workspaceId: approval.workspaceId,
      workflowRunId: approval.workflowRunId,
      nodeId: approval.nodeId,
      stepId: `${approval.workflowRunId}_${approval.nodeId}`,
      status: approval.status,
      review: approval.payloadJson,
      decidedById: approval.decidedById ?? undefined,
      comment: approval.comment ?? undefined,
      requestedAt: approval.requestedAt.toISOString(),
      decidedAt: approval.decidedAt?.toISOString()
    };
  }
}
