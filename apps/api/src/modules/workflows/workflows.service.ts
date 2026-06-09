import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  sampleLeadWorkflowDefinition,
  validateWorkflowDefinition,
  workflowDefinitionSchema,
  type WorkflowDefinition,
  type WorkflowStatus
} from "@agentops/shared";
import { kafkaTopics } from "@agentops/events";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
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
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
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
  nodeType: string;
  status: "PENDING" | "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED" | "SKIPPED";
  message: string;
};

@Injectable()
export class WorkflowsService {
  private readonly workflows: WorkflowRecord[] = [
    {
      id: "wf_lead_qualification",
      workspaceId: "ws_demo",
      name: "Lead qualification",
      description: "Score a new lead, branch on intent, and send a webhook mock.",
      status: "DRAFT",
      createdBy: "user_demo",
      definition: sampleLeadWorkflowDefinition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  private readonly versions: WorkflowVersionRecord[] = [];
  private readonly runs: WorkflowRunRecord[] = [];

  constructor(@Inject(DomainEventsService) private readonly events: DomainEventsService) {}

  findAll(workspaceId?: string) {
    return workspaceId ? this.workflows.filter((workflow) => workflow.workspaceId === workspaceId) : this.workflows;
  }

  create(dto: CreateWorkflowDto) {
    const definition = this.parseDefinition(dto.definition);
    const workflow: WorkflowRecord = {
      id: `wf_${randomUUID()}`,
      workspaceId: dto.workspaceId,
      name: dto.name,
      description: dto.description,
      status: "DRAFT",
      createdBy: "user_demo",
      definition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.workflows.push(workflow);
    return workflow;
  }

  findOne(id: string) {
    const workflow = this.workflows.find((candidate) => candidate.id === id);
    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }
    return workflow;
  }

  update(id: string, dto: UpdateWorkflowDto) {
    const workflow = this.findOne(id);
    if (workflow.status === "ARCHIVED") {
      throw new BadRequestException("Archived workflows cannot be edited");
    }

    Object.assign(workflow, {
      name: dto.name ?? workflow.name,
      description: dto.description ?? workflow.description,
      definition: dto.definition ? this.parseDefinition(dto.definition) : workflow.definition,
      updatedAt: new Date().toISOString()
    });
    return workflow;
  }

  remove(id: string) {
    const workflow = this.findOne(id);
    workflow.status = "ARCHIVED";
    workflow.updatedAt = new Date().toISOString();
    return { success: true, workflow };
  }

  publish(id: string) {
    const workflow = this.findOne(id);
    const issues = validateWorkflowDefinition(workflow.definition);
    if (issues.length > 0) {
      throw new BadRequestException({ message: "Workflow graph is invalid", issues });
    }

    const version: WorkflowVersionRecord = {
      id: `wfv_${randomUUID()}`,
      workflowId: workflow.id,
      versionNumber: this.versions.filter((candidate) => candidate.workflowId === workflow.id).length + 1,
      definition: workflow.definition,
      createdAt: new Date().toISOString()
    };
    this.versions.push(version);
    workflow.currentVersionId = version.id;
    workflow.status = "ACTIVE";
    workflow.updatedAt = new Date().toISOString();
    return { workflow, version };
  }

  run(id: string, dto: RunWorkflowDto) {
    const workflow = this.findOne(id);
    const version = workflow.currentVersionId
      ? this.versions.find((candidate) => candidate.id === workflow.currentVersionId)
      : this.publish(id).version;

    if (!version) {
      throw new BadRequestException("Workflow must be published before it can run");
    }

    const run: WorkflowRunRecord = {
      id: `run_${randomUUID()}`,
      workflowId: workflow.id,
      workspaceId: workflow.workspaceId,
      workflowVersionId: version.id,
      status: "PENDING",
      triggerType: dto.triggerType ?? "manual",
      input: dto.input ?? {},
      createdAt: new Date().toISOString()
    };

    const event = this.events.publish({
      type: kafkaTopics.workflowTriggered,
      workspaceId: workflow.workspaceId,
      workflowId: workflow.id,
      workflowRunId: run.id,
      payload: {
        input: run.input,
        triggerType: run.triggerType,
        workflowVersionId: version.id,
        definition: version.definition
      }
    });

    run.eventId = event.eventId;
    this.runs.push(run);
    workflowRunsTotal.inc({
      workspace_id: run.workspaceId,
      workflow_id: run.workflowId,
      trigger_type: run.triggerType
    });
    return { run, event };
  }

  runsForWorkflow(workflowId: string) {
    this.findOne(workflowId);
    return this.runs.filter((run) => run.workflowId === workflowId);
  }

  findRun(id: string) {
    const run = this.runs.find((candidate) => candidate.id === id);
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }
    return run;
  }

  listRuns() {
    return this.runs;
  }

  stepsForRun(id: string): { workflowRunId: string; steps: WorkflowRunStepRecord[] } {
    const run = this.findRun(id);
    const version = this.versions.find((candidate) => candidate.id === run.workflowVersionId);
    const definition = version?.definition ?? this.findOne(run.workflowId).definition;

    return {
      workflowRunId: run.id,
      steps: definition.nodes.map((node, index) => ({
        id: `${run.id}_${node.id}`,
        workflowRunId: run.id,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: index === 0 ? "COMPLETED" : "PENDING",
        message:
          index === 0
            ? "Trigger accepted by API and workflow event published."
            : "Waiting for workflow-worker execution in the async pipeline."
      }))
    };
  }

  private parseDefinition(input: unknown): WorkflowDefinition {
    const definition = workflowDefinitionSchema.parse(input);
    return definition;
  }
}
