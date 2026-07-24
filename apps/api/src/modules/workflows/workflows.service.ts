import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@agentops/database";
import {
  validateWorkflowDefinition,
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

type WorkflowRunRecord = {
  id: string;
  workflowId: string;
  workspaceId: string;
  workflowVersionId: string;
  status: WorkflowRunStatus;
  triggerType: string;
  input: Record<string, unknown>;
  createdAt: string;
  eventId?: string;
};

type WorkflowRunStepRecord = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  status: WorkflowStepStatus;
  message: string;
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
};

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(DomainEventsService) private readonly events: DomainEventsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoDataService) private readonly demoData: DemoDataService
  ) {}

  async findAll(workspaceId?: string) {
    await this.demoData.ensureDemoWorkflow();
    const workflows = await this.prisma.client.workflow.findMany({
      where: workspaceId ? { workspaceId } : undefined,
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
    let workflow = await this.findWorkflowRecord(id);
    let version = workflow.currentVersionId ? await this.findWorkflowVersionRecord(workflow.currentVersionId) : undefined;

    if (!version) {
      const published = await this.publish(id);
      workflow = await this.findWorkflowRecord(id);
      version = await this.findWorkflowVersionRecord(published.version.id);
    }

    const definition = this.parseDefinition(version.definitionJson);
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
          inputJson: toInputJson(dto.input ?? {})
        }
      });

      await tx.workflowStepRun.createMany({
        data: definition.nodes.map((node, index) => ({
          id: `${runId}_${node.id}`,
          workflowRunId: runId,
          nodeId: node.id,
          nodeType: node.type,
          status: index === 0 ? "COMPLETED" : "PENDING",
          inputJson: index === 0 ? toInputJson(dto.input ?? {}) : undefined,
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
        input: dto.input ?? {},
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
      orderBy: { createdAt: "desc" }
    });

    return runs.map((run) => this.toWorkflowRunRecord(run));
  }

  async stepsForRun(id: string): Promise<{ workflowRunId: string; steps: WorkflowRunStepRecord[] }> {
    const run = await this.prisma.client.workflowRun.findUnique({
      where: { id },
      include: {
        workflowVersion: true,
        steps: true
      }
    });
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }

    const definition = this.parseDefinition(run.workflowVersion.definitionJson);

    return {
      workflowRunId: run.id,
      steps: definition.nodes.map((node, index) => {
        const persisted = run.steps.find((step) => step.nodeId === node.id);
        return {
          id: persisted?.id ?? `${run.id}_${node.id}`,
          workflowRunId: run.id,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          status: (persisted?.status ?? (index === 0 ? "COMPLETED" : "PENDING")) as WorkflowStepStatus,
          message: this.stepMessage(index, persisted?.errorMessage ?? undefined)
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

  private async findWorkflowVersionRecord(id: string): Promise<WorkflowVersionDbRecord> {
    const version = await this.prisma.client.workflowVersion.findUnique({ where: { id } });
    if (!version) {
      throw new NotFoundException("Workflow version not found");
    }

    return version;
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

  private toWorkflowRunRecord(run: WorkflowRunDbRecord): WorkflowRunRecord {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workspaceId: run.workspaceId,
      workflowVersionId: run.workflowVersionId,
      status: run.status as WorkflowRunStatus,
      triggerType: run.triggerType,
      input: run.inputJson as Record<string, unknown>,
      createdAt: run.createdAt.toISOString(),
      eventId: run.triggerEventId ?? undefined
    };
  }

  private stepMessage(index: number, errorMessage?: string) {
    if (errorMessage) {
      return errorMessage;
    }

    return index === 0
      ? "Trigger accepted by API and workflow event published."
      : "Waiting for workflow-worker execution in the async pipeline.";
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
