import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@agentops/database";
import {
  formatLeadInputErrors,
  leadInputSchema,
  maskSensitivePromptInput,
  requiresLeadInput,
  validateWorkflowDefinition,
  type WorkflowRunStepView,
  type WorkflowRunStepsView,
  type WorkflowRunView,
  workflowDefinitionSchema,
  type WorkflowDefinition,
  type WorkflowNodeType,
  type WorkflowRunStatus,
  type WorkflowStatus,
  type WorkflowStepStatus
} from "@agentops/shared";
import { kafkaTopics } from "@agentops/events";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { DemoDataService, demoUserId, demoWorkspaceId } from "../../common/infrastructure/demo-data.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { workflowRunsTotal } from "../../common/metrics/api-metrics";
import type { CreateWorkflowDto, RunWorkflowDto, UpdateWorkflowDto } from "./dto";

type WorkflowRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  currentVersionId?: string;
  createdBy: string;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
};

type WorkflowVersionRecord = {
  id: string;
  workflowId: string;
  versionNumber: number;
  definition: WorkflowDefinition;
  createdAt: string;
};

type WorkflowDbRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: string;
  currentVersionId: string | null;
  definitionJson: unknown;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

type WorkflowVersionDbRecord = {
  id: string;
  workflowId: string;
  versionNumber: number;
  definitionJson: unknown;
  createdAt: Date;
};

type WorkflowRunDbRecord = {
  id: string;
  workflowId: string;
  workspaceId: string;
  workflowVersionId: string;
  status: string;
  triggerType: string;
  inputJson: unknown;
  triggerEventId: string | null;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  errorMessage?: string | null;
};

const stepStatusMessages: Record<WorkflowStepStatus, string> = {
  PENDING: "Waiting for workflow-worker execution in the async pipeline.",
  RUNNING: "Running in a worker.",
  WAITING_APPROVAL: "Waiting for a reviewer to approve or reject.",
  COMPLETED: "Completed.",
  FAILED: "Failed.",
  SKIPPED: "Branch not taken."
};

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(DomainEventsService) private readonly events: DomainEventsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoDataService) private readonly demoData: DemoDataService
  ) {}

  /** Archived workflows are hidden unless the caller explicitly asks for them. */
  async findAll(workspaceId?: string, userId?: string, includeArchived = false) {
    await this.demoData.ensureDemoWorkflow();
    const workflows = await this.prisma.client.workflow.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        ...(userId ? { workspace: { members: { some: { userId } } } } : {}),
        ...(includeArchived ? {} : { status: { not: "ARCHIVED" } })
      },
      orderBy: { updatedAt: "desc" }
    });

    return workflows.map((workflow) => this.toWorkflowRecord(workflow));
  }

  async create(dto: CreateWorkflowDto) {
    const definition = this.parseDefinition(dto.definition);
    await this.ensureWorkspace(dto.workspaceId);

    const workflow = await this.prisma.client.workflow.create({
      data: {
        id: `wf_${randomUUID()}`,
        workspaceId: dto.workspaceId,
        name: dto.name,
        description: dto.description,
        status: "DRAFT",
        createdById: demoUserId,
        definitionJson: toInputJson(definition)
      }
    });

    return this.toWorkflowRecord(workflow);
  }

  async findOne(id: string) {
    await this.demoData.ensureDemoWorkflow();
    return this.toWorkflowRecord(await this.findWorkflowRecord(id));
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    await this.demoData.ensureDemoWorkflow();
    const workflow = await this.findWorkflowRecord(id);
    if (workflow.status === "ARCHIVED") {
      throw new BadRequestException("Archived workflows cannot be edited");
    }

    const updated = await this.prisma.client.workflow.update({
      where: { id },
      data: {
        name: dto.name ?? workflow.name,
        description: dto.description ?? workflow.description,
        ...(dto.definition ? { definitionJson: toInputJson(this.parseDefinition(dto.definition)) } : {})
      }
    });

    return this.toWorkflowRecord(updated);
  }

  async remove(id: string) {
    await this.demoData.ensureDemoWorkflow();
    const workflow = await this.findWorkflowRecord(id);
    const archived = await this.prisma.client.workflow.update({
      where: { id: workflow.id },
      data: { status: "ARCHIVED" }
    });

    return { success: true, workflow: this.toWorkflowRecord(archived) };
  }

  async publish(id: string) {
    await this.demoData.ensureDemoWorkflow();
    const workflow = await this.findWorkflowRecord(id);
    this.assertNotArchived(workflow);
    const definition = this.parseDefinition(workflow.definitionJson);
    const issues = validateWorkflowDefinition(definition);
    if (issues.length > 0) {
      throw new BadRequestException({ message: "Workflow graph is invalid", issues });
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const versionNumber = (await tx.workflowVersion.count({ where: { workflowId: workflow.id } })) + 1;
      const version = await tx.workflowVersion.create({
        data: {
          id: `wfv_${randomUUID()}`,
          workflowId: workflow.id,
          versionNumber,
          definitionJson: toInputJson(definition),
          createdById: workflow.createdById
        }
      });
      const updatedWorkflow = await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          currentVersionId: version.id,
          status: "ACTIVE"
        }
      });

      return { workflow: updatedWorkflow, version };
    });

    return {
      workflow: this.toWorkflowRecord(result.workflow),
      version: this.toWorkflowVersionRecord(result.version)
    };
  }

  async run(id: string, dto: RunWorkflowDto) {
    await this.demoData.ensureDemoWorkflow();
    const workflow = await this.findWorkflowRecord(id);
    this.assertNotArchived(workflow);
    const version = workflow.currentVersionId
      ? await this.findWorkflowVersionRecord(workflow.currentVersionId)
      : undefined;

    // Publishing is an ADMIN action, so a run must never publish a draft on the caller's behalf.
    if (!version) {
      throw new ConflictException({
        message: "Workflow has no published version. Publish it before running.",
        code: "WORKFLOW_NOT_PUBLISHED"
      });
    }

    const definition = this.parseDefinition(version.definitionJson);
    const input = this.resolveRunInput(definition, dto.input);
    const runId = `run_${randomUUID()}`;
    const run = await this.prisma.client.$transaction(async (tx) => {
      const createdRun = await tx.workflowRun.create({
        data: {
          id: runId,
          workflowId: workflow.id,
          workspaceId: workflow.workspaceId,
          workflowVersionId: version.id,
          status: "PENDING",
          triggerType: dto.triggerType ?? "manual",
          inputJson: toInputJson(input)
        }
      });

      await tx.workflowStepRun.createMany({
        data: definition.nodes.map((node, index) => ({
          id: `${runId}_${node.id}`,
          workflowRunId: runId,
          nodeId: node.id,
          nodeType: node.type,
          status: index === 0 ? "COMPLETED" : "PENDING",
          inputJson: index === 0 ? toInputJson(input) : undefined,
          outputJson: index === 0 ? toInputJson({ message: "Trigger accepted by API and workflow event published." }) : undefined
        }))
      });

      return createdRun;
    });

    const event = await this.events.publish({
      type: kafkaTopics.workflowTriggered,
      workspaceId: workflow.workspaceId,
      workflowId: workflow.id,
      workflowRunId: run.id,
      payload: {
        input,
        triggerType: dto.triggerType ?? "manual",
        workflowVersionId: version.id,
        definition
      }
    });

    const updatedRun = await this.prisma.client.workflowRun.update({
      where: { id: run.id },
      data: { triggerEventId: event.eventId }
    });

    workflowRunsTotal.inc({
      workspace_id: updatedRun.workspaceId,
      workflow_id: updatedRun.workflowId,
      trigger_type: updatedRun.triggerType
    });

    return { run: this.toWorkflowRunRecord(updatedRun), event };
  }

  async runsForWorkflow(workflowId: string) {
    await this.demoData.ensureDemoWorkflow();
    await this.findWorkflowRecord(workflowId);
    const runs = await this.prisma.client.workflowRun.findMany({
      where: { workflowId },
      orderBy: { createdAt: "desc" }
    });

    return runs.map((run) => this.toWorkflowRunRecord(run));
  }

  async findRun(id: string) {
    const run = await this.prisma.client.workflowRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }

    return this.toWorkflowRunRecord(run);
  }

  async listRuns() {
    const runs = await this.prisma.client.workflowRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return runs.map((run) => this.toWorkflowRunRecord(run));
  }

  /** Step timeline from the immutable version, merged with what the workers persisted (input is masked). */
  async stepsForRun(id: string): Promise<WorkflowRunStepsView> {
    const run = await this.prisma.client.workflowRun.findUnique({
      where: { id },
      include: {
        workflowVersion: true,
        steps: true,
        aiTaskResults: true
      }
    });
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }

    const definition = this.parseDefinition(run.workflowVersion.definitionJson);

    return {
      workflowRunId: run.id,
      steps: definition.nodes.map((node, index): WorkflowRunStepView => {
        const persisted = run.steps.find((step) => step.nodeId === node.id);
        const status = (persisted?.status ?? (index === 0 ? "COMPLETED" : "PENDING")) as WorkflowStepStatus;
        const ai = run.aiTaskResults.find((result) => result.nodeId === node.id);
        const startedAt = persisted?.startedAt ?? undefined;
        const finishedAt = persisted?.finishedAt ?? undefined;
        return {
          id: persisted?.id ?? `${run.id}_${node.id}`,
          workflowRunId: run.id,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          status,
          message: persisted?.errorMessage ?? (index === 0 && status === "COMPLETED" ? "Trigger accepted by API and workflow event published." : stepStatusMessages[status]),
          input: persisted?.inputJson == null ? undefined : maskSensitivePromptInput(persisted.inputJson),
          output: persisted?.outputJson ?? undefined,
          errorMessage: persisted?.errorMessage ?? undefined,
          startedAt: startedAt?.toISOString(),
          finishedAt: finishedAt?.toISOString(),
          durationMs: startedAt && finishedAt ? finishedAt.getTime() - startedAt.getTime() : undefined,
          retryCount: persisted?.retryCount ?? 0,
          tokenUsage: ai
            ? { provider: ai.provider, modelName: ai.modelName, inputTokens: ai.inputTokens, outputTokens: ai.outputTokens }
            : undefined
        };
      })
    };
  }

  private async ensureWorkspace(workspaceId: string) {
    if (workspaceId === demoWorkspaceId) {
      await this.demoData.ensureDemoWorkspace();
      return;
    }

    const workspace = await this.prisma.client.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
  }

  private async findWorkflowRecord(id: string): Promise<WorkflowDbRecord> {
    const workflow = await this.prisma.client.workflow.findUnique({ where: { id } });
    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }

    return workflow;
  }

  /** Archived workflows are read-only: they can neither be published nor run. */
  private assertNotArchived(workflow: WorkflowDbRecord) {
    if (workflow.status === "ARCHIVED") {
      throw new ConflictException({
        message: "Workflow is archived.",
        code: "WORKFLOW_ARCHIVED"
      });
    }
  }

  private async findWorkflowVersionRecord(id: string): Promise<WorkflowVersionDbRecord | undefined> {
    return (await this.prisma.client.workflowVersion.findUnique({ where: { id } })) ?? undefined;
  }

  /** Lead workflows only accept a valid lead payload; other workflows take the input as is. */
  private resolveRunInput(definition: WorkflowDefinition, input: Record<string, unknown> | undefined) {
    if (!requiresLeadInput(definition)) {
      return input ?? {};
    }

    const parsed = leadInputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid lead input",
        code: "INVALID_LEAD_INPUT",
        details: formatLeadInputErrors(parsed.error)
      });
    }

    return parsed.data;
  }

  private parseDefinition(input: unknown): WorkflowDefinition {
    return workflowDefinitionSchema.parse(input);
  }

  private toWorkflowRecord(workflow: WorkflowDbRecord): WorkflowRecord {
    return {
      id: workflow.id,
      workspaceId: workflow.workspaceId,
      name: workflow.name,
      description: workflow.description ?? undefined,
      status: workflow.status as WorkflowStatus,
      currentVersionId: workflow.currentVersionId ?? undefined,
      createdBy: workflow.createdById,
      definition: this.parseDefinition(workflow.definitionJson),
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString()
    };
  }

  private toWorkflowVersionRecord(version: WorkflowVersionDbRecord): WorkflowVersionRecord {
    return {
      id: version.id,
      workflowId: version.workflowId,
      versionNumber: version.versionNumber,
      definition: this.parseDefinition(version.definitionJson),
      createdAt: version.createdAt.toISOString()
    };
  }

  private toWorkflowRunRecord(run: WorkflowRunDbRecord): WorkflowRunView {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workspaceId: run.workspaceId,
      workflowVersionId: run.workflowVersionId,
      status: run.status as WorkflowRunStatus,
      triggerType: run.triggerType,
      // Lead input contains PII: clients only ever see the masked form.
      input: maskSensitivePromptInput(run.inputJson ?? {}) as Record<string, unknown>,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      errorMessage: run.errorMessage ?? undefined,
      eventId: run.triggerEventId ?? undefined
    };
  }
}
function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
