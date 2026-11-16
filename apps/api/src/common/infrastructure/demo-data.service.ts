import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@agentops/database";
import { isRejectedEdgeCondition, sampleLeadWorkflowDefinition, workflowDefinitionSchema } from "@agentops/shared";
import { PrismaService } from "./prisma.service";

export const demoUserId = "user_demo";
export const demoWorkspaceId = "ws_demo";
export const demoWorkflowId = "wf_lead_qualification";

/** The demo workflow row: only the columns the upgrade reads. */
type DemoWorkflowRow = {
  id: string;
  currentVersionId?: string | null;
  createdById?: string | null;
};

/** A published workflow version: only the columns the upgrade reads. */
type DemoVersionRow = {
  id?: string | null;
  workflowId?: string | null;
  versionNumber?: number | null;
  definitionJson?: unknown;
};

@Injectable()
export class DemoDataService {
  // The demo rows only need to exist once per process: memoising the upserts removes 3-4 writes from
  // every request (they dominated trigger latency in the 1000-request load test). Reset on failure.
  private workspaceReady: ReturnType<DemoDataService["createDemoWorkspace"]> | undefined;
  private workflowReady: ReturnType<DemoDataService["createDemoWorkflow"]> | undefined;
  private readonly logger = new Logger(DemoDataService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  ensureDemoWorkspace() {
    this.workspaceReady ??= this.createDemoWorkspace().catch((error: unknown) => {
      this.workspaceReady = undefined;
      throw error;
    });
    return this.workspaceReady;
  }

  ensureDemoWorkflow() {
    this.workflowReady ??= this.createDemoWorkflow().catch((error: unknown) => {
      this.workflowReady = undefined;
      throw error;
    });
    return this.workflowReady;
  }

  private async createDemoWorkspace() {
    await this.prisma.client.user.upsert({
      where: { id: demoUserId },
      update: {},
      create: {
        id: demoUserId,
        email: "demo@agentops.local",
        name: "Demo Operator",
        passwordHash: "demo-account-password-disabled"
      }
    });

    const workspace = await this.prisma.client.workspace.upsert({
      where: { id: demoWorkspaceId },
      update: {},
      create: {
        id: demoWorkspaceId,
        name: "AgentOps Demo",
        slug: "agentops-demo",
        ownerId: demoUserId,
        plan: "FREE"
      }
    });

    await this.prisma.client.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: demoWorkspaceId,
          userId: demoUserId
        }
      },
      update: {},
      create: {
        id: "wsm_demo_owner",
        workspaceId: demoWorkspaceId,
        userId: demoUserId,
        role: "OWNER"
      }
    });

    return workspace;
  }

  private async createDemoWorkflow() {
    await this.ensureDemoWorkspace();

    const workflow = await this.prisma.client.workflow.upsert({
      where: { id: demoWorkflowId },
      update: {},
      create: {
        id: demoWorkflowId,
        workspaceId: demoWorkspaceId,
        name: "Lead qualification",
        description: "Score a new lead, branch on intent, and send a webhook mock.",
        status: "DRAFT",
        definitionJson: toInputJson(sampleLeadWorkflowDefinition),
        createdById: demoUserId
      }
    });

    await this.upgradeDemoWorkflow(workflow);

    return workflow;
  }

  /**
   * Databases created before the `rejected` edge existed still publish the old lead template:
   * rejecting an email then cancels the run instead of creating the sales task for the hot lead.
   * Republish the current template as a new version once, so every database runs the same graph.
   */
  private async upgradeDemoWorkflow(workflow: DemoWorkflowRow) {
    const published = await this.loadPublishedVersion(workflow);
    if (published && hasRejectedEdge(published.definitionJson)) {
      return;
    }

    await this.prisma.client.$transaction(async (tx) => {
      const versionId = `wfv_${randomUUID()}`;
      const versionNumber = await this.nextVersionNumber(tx, workflow.id, published);
      const created = (await tx.workflowVersion.create({
        data: {
          id: versionId,
          workflowId: workflow.id,
          versionNumber,
          definitionJson: toInputJson(sampleLeadWorkflowDefinition),
          createdById: workflow.createdById ?? demoUserId
        }
      })) as { id?: string | null };

      await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          currentVersionId: created.id ?? versionId,
          // The draft must match too, otherwise the next publish would bring the old graph back.
          definitionJson: toInputJson(sampleLeadWorkflowDefinition),
          status: "ACTIVE"
        }
      });
    });

    this.logger.log("demo workflow upgraded to the current lead template");
  }

  /** The version the workflow currently publishes, or the most recent one when none is referenced. */
  private async loadPublishedVersion(workflow: DemoWorkflowRow): Promise<DemoVersionRow | undefined> {
    const versions = this.prisma.client.workflowVersion;
    // Prisma always exposes both lookups: the guards keep the upgrade working on a partial delegate.

    if (workflow.currentVersionId && typeof versions.findUnique === "function") {
      const published = await versions.findUnique({ where: { id: workflow.currentVersionId } });
      if (published) {
        return published;
      }
    }

    if (typeof versions.findFirst === "function") {
      const latest = await versions.findFirst({
        where: { workflowId: workflow.id },
        orderBy: { versionNumber: "desc" }
      });
      if (latest) {
        return latest;
      }
    }

    return undefined;
  }

  /** The next free version number of the workflow. */
  private async nextVersionNumber(
    tx: Prisma.TransactionClient,
    workflowId: string,
    published?: DemoVersionRow
  ): Promise<number> {
    const versions = tx.workflowVersion;
    if (typeof versions.count === "function") {
      const count = await versions.count({ where: { workflowId } });
      if (Number.isFinite(count)) {
        return count + 1;
      }
    }

    // Without a count the published version still gives the next free number.
    return (published?.versionNumber ?? 0) + 1;
  }
}

/** True when the definition already carries the reserved `rejected` edge. */
function hasRejectedEdge(definition: unknown): boolean {
  const parsed = workflowDefinitionSchema.safeParse(definition);
  return parsed.success && parsed.data.edges.some((edge) => isRejectedEdgeCondition(edge.condition));
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
