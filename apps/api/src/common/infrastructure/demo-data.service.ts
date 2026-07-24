import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@agentops/database";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { PrismaService } from "./prisma.service";

export const demoUserId = "user_demo";
export const demoWorkspaceId = "ws_demo";
export const demoWorkflowId = "wf_lead_qualification";

@Injectable()
export class DemoDataService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ensureDemoWorkspace() {
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

  async ensureDemoWorkflow() {
    await this.ensureDemoWorkspace();

    return this.prisma.client.workflow.upsert({
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
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
