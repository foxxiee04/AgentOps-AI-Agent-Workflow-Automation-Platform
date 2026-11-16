import "dotenv/config";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { createPrismaClient, localDatabaseUrl, Prisma } from "../src";

const demoUserId = "user_demo";
const demoWorkspaceId = "ws_demo";
const demoWorkflowId = "wf_lead_qualification";
const demoVersionId = "wfv_seed_lead_qualification_v1";
const demoRunId = "run_seed_lead_qualification";
const demoEventId = "evt_seed_workflow_triggered";

async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL ?? localDatabaseUrl);
  const definitionJson = toInputJson(sampleLeadWorkflowDefinition);

  try {
    await prisma.user.upsert({
      where: { id: demoUserId },
      update: {
        email: "demo@agentops.local",
        name: "Demo Operator"
      },
      create: {
        id: demoUserId,
        email: "demo@agentops.local",
        name: "Demo Operator",
        passwordHash: "demo-account-password-disabled"
      }
    });

    await prisma.workspace.upsert({
      where: { id: demoWorkspaceId },
      update: {
        name: "AgentOps Demo",
        slug: "agentops-demo",
        ownerId: demoUserId,
        plan: "FREE"
      },
      create: {
        id: demoWorkspaceId,
        name: "AgentOps Demo",
        slug: "agentops-demo",
        ownerId: demoUserId,
        plan: "FREE"
      }
    });

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: demoWorkspaceId,
          userId: demoUserId
        }
      },
      update: { role: "OWNER" },
      create: {
        id: "wsm_demo_owner",
        workspaceId: demoWorkspaceId,
        userId: demoUserId,
        role: "OWNER"
      }
    });

    await prisma.workflow.upsert({
      where: { id: demoWorkflowId },
      update: {
        name: "Lead qualification",
        description: "Score a new lead, branch on intent, draft an email for approval, and create a sales task.",
        status: "ACTIVE",
        definitionJson,
        createdById: demoUserId
      },
      create: {
        id: demoWorkflowId,
        workspaceId: demoWorkspaceId,
        name: "Lead qualification",
        description: "Score a new lead, branch on intent, draft an email for approval, and create a sales task.",
        status: "ACTIVE",
        definitionJson,
        createdById: demoUserId
      }
    });

    const version = await prisma.workflowVersion.upsert({
      where: {
        workflowId_versionNumber: {
          workflowId: demoWorkflowId,
          versionNumber: 1
        }
      },
      update: {
        definitionJson,
        createdById: demoUserId
      },
      create: {
        id: demoVersionId,
        workflowId: demoWorkflowId,
        versionNumber: 1,
        definitionJson,
        createdById: demoUserId
      }
    });

    await prisma.workflow.update({
      where: { id: demoWorkflowId },
      data: {
        status: "ACTIVE",
        currentVersionId: version.id
      }
    });

    await prisma.workflowRun.upsert({
      where: { id: demoRunId },
      update: {
        workflowVersionId: version.id,
        status: "COMPLETED",
        triggerType: "manual",
        inputJson: toInputJson({
          leadName: "Northstar Ops",
          source: "seed",
          intent: "urgent sales automation"
        }),
        outputJson: toInputJson({
          leadScore: 87,
          category: "high-intent",
          recommendedAction: "Send personalized follow-up"
        }),
        triggerEventId: demoEventId,
        startedAt: new Date("2026-07-24T03:00:00.000Z"),
        finishedAt: new Date("2026-07-24T03:00:05.000Z")
      },
      create: {
        id: demoRunId,
        workflowId: demoWorkflowId,
        workflowVersionId: version.id,
        workspaceId: demoWorkspaceId,
        status: "COMPLETED",
        triggerType: "manual",
        inputJson: toInputJson({
          leadName: "Northstar Ops",
          source: "seed",
          intent: "urgent sales automation"
        }),
        outputJson: toInputJson({
          leadScore: 87,
          category: "high-intent",
          recommendedAction: "Send personalized follow-up"
        }),
        triggerEventId: demoEventId,
        startedAt: new Date("2026-07-24T03:00:00.000Z"),
        finishedAt: new Date("2026-07-24T03:00:05.000Z")
      }
    });

    for (const [index, node] of sampleLeadWorkflowDefinition.nodes.entries()) {
      await prisma.workflowStepRun.upsert({
        where: {
          workflowRunId_nodeId: {
            workflowRunId: demoRunId,
            nodeId: node.id
          }
        },
        update: {
          nodeType: node.type,
          status: "COMPLETED",
          inputJson: toInputJson({ seeded: true, order: index + 1 }),
          outputJson: toInputJson({ message: `${node.name} completed in seed run.` }),
          errorMessage: null,
          retryCount: 0
        },
        create: {
          id: `step_seed_${node.id}`,
          workflowRunId: demoRunId,
          nodeId: node.id,
          nodeType: node.type,
          status: "COMPLETED",
          inputJson: toInputJson({ seeded: true, order: index + 1 }),
          outputJson: toInputJson({ message: `${node.name} completed in seed run.` }),
          retryCount: 0
        }
      });
    }

    await prisma.domainEvent.upsert({
      where: { id: demoEventId },
      update: {
        type: "workflow-triggered",
        workspaceId: demoWorkspaceId,
        workflowId: demoWorkflowId,
        workflowRunId: demoRunId,
        requestId: "seed-request",
        traceId: "00000000000000000000000000000001",
        traceparent: "00-00000000000000000000000000000001-0000000000000001-00",
        payloadJson: toInputJson({
          triggerType: "manual",
          workflowVersionId: version.id,
          input: {
            source: "seed",
            intent: "urgent sales automation"
          }
        }),
        kafkaPublishedAt: new Date("2026-07-24T03:00:00.000Z"),
        kafkaError: null
      },
      create: {
        id: demoEventId,
        type: "workflow-triggered",
        workspaceId: demoWorkspaceId,
        workflowId: demoWorkflowId,
        workflowRunId: demoRunId,
        requestId: "seed-request",
        traceId: "00000000000000000000000000000001",
        traceparent: "00-00000000000000000000000000000001-0000000000000001-00",
        payloadJson: toInputJson({
          triggerType: "manual",
          workflowVersionId: version.id,
          input: {
            source: "seed",
            intent: "urgent sales automation"
          }
        }),
        kafkaPublishedAt: new Date("2026-07-24T03:00:00.000Z")
      }
    });

    await prisma.usageRecord.deleteMany({
      where: {
        workspaceId: demoWorkspaceId,
        workflowRunId: demoRunId
      }
    });
    await prisma.usageRecord.create({
      data: {
        workspaceId: demoWorkspaceId,
        workflowRunId: demoRunId,
        aiTokensUsed: 128,
        workflowStepsExecuted: sampleLeadWorkflowDefinition.nodes.length
      }
    });

    console.log("Seeded AgentOps demo workspace, workflow, run, event, and usage records.");
  } finally {
    await prisma.$disconnect();
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
