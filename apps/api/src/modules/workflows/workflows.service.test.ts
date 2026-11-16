import { BadRequestException, ConflictException } from "@nestjs/common";
import { createEvent } from "@agentops/events";
import { sampleLeadWorkflowDefinition, type WorkflowDefinition } from "@agentops/shared";
import { describe, expect, it, vi } from "vitest";
import { WorkflowsService } from "./workflows.service";

const validLead = {
  name: "Anna Nguyen",
  email: "anna@shopabc.vn",
  message: "We need to automate our chat support and order processing.",
  company: "Shop ABC",
  source: "website_form"
};

const manualDefinition: WorkflowDefinition = {
  nodes: [
    { id: "trigger-1", type: "TRIGGER", name: "Manual trigger", config: { triggerType: "manual" } },
    { id: "end-1", type: "END", name: "Done", config: {} }
  ],
  edges: []
};

describe("WorkflowsService", () => {
  it("persists a workflow run before publishing a workflow-triggered event", async () => {
    const harness = createHarness();
    const result = await harness.service.run("wf_lead_qualification", {
      input: validLead,
      triggerType: "manual"
    });

    expect(result.event.type).toBe("workflow-triggered");
    expect(result.run.workflowVersionId).toMatch(/^wfv_/);
    expect(result.run.eventId).toBe(result.event.eventId);
    expect(harness.runs).toHaveLength(1);
    expect(harness.steps).toHaveLength(sampleLeadWorkflowDefinition.nodes.length);
    expect(harness.events.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      harness.workflowRunCreate.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("builds a run step timeline from persisted step rows and the immutable workflow version", async () => {
    const harness = createHarness();
    const result = await harness.service.run("wf_lead_qualification", {
      input: validLead,
      triggerType: "manual"
    });
    const timeline = await harness.service.stepsForRun(result.run.id);

    expect(timeline.workflowRunId).toBe(result.run.id);
    expect(timeline.steps.map((step) => step.nodeId)).toEqual(sampleLeadWorkflowDefinition.nodes.map((node) => node.id));
    expect(timeline.steps[0]?.status).toBe("COMPLETED");
    expect(timeline.steps.find((step) => step.nodeId === "ai-1")?.tokenUsage).toEqual({
      provider: "mock",
      modelName: "gpt-4o-mini",
      inputTokens: 120,
      outputTokens: 40
    });
    // The trigger step keeps the lead input, but clients only ever receive it masked.
    expect(timeline.steps[0]?.input).toEqual({
      name: "Anna Nguyen",
      email: "an***@shopabc.vn",
      message: "We need to automate our chat support and order processing.",
      company: "Shop ABC",
      source: "website_form"
    });
  });

  it("masks PII in the run input returned to clients", async () => {
    const harness = createHarness();
    const result = await harness.service.run("wf_lead_qualification", {
      input: { name: "Anna", email: "anna@shopabc.vn", phone: "+84 912 345 678", message: "We need a chatbot." },
      triggerType: "webhook"
    });

    const run = await harness.service.findRun(result.run.id);

    expect(run.input).toEqual({
      name: "Anna",
      email: "an***@shopabc.vn",
      phone: "[PHONE_REDACTED]",
      message: "We need a chatbot."
    });
  });

  it("refuses to run a workflow that has no published version and never publishes it implicitly", async () => {
    const harness = createHarness({ published: false });
    const publish = vi.spyOn(harness.service, "publish");

    const error = await harness.service
      .run("wf_lead_qualification", { input: validLead, triggerType: "manual" })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      message: "Workflow has no published version. Publish it before running.",
      code: "WORKFLOW_NOT_PUBLISHED"
    });
    expect(publish).not.toHaveBeenCalled();
    expect(harness.runs).toHaveLength(0);
    expect(harness.events.publish).not.toHaveBeenCalled();
  });

  it("rejects a lead run whose input is not a valid lead", async () => {
    const harness = createHarness();

    const error = await harness.service
      .run("wf_lead_qualification", { input: {}, triggerType: "manual" })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      message: string;
      code: string;
      details: Record<string, string>;
    };
    expect(response.message).toBe("Invalid lead input");
    expect(response.code).toBe("INVALID_LEAD_INPUT");
    expect(Object.keys(response.details)).toContain("email");
    expect(harness.runs).toHaveLength(0);
    expect(harness.events.publish).not.toHaveBeenCalled();
  });

  it("creates a run for a valid lead and stores the trimmed input", async () => {
    const harness = createHarness();

    const result = await harness.service.run("wf_lead_qualification", {
      input: { name: "  Anna Nguyen  ", email: "anna@shopabc.vn", message: "  We need automation.  ", budget: 5000000 },
      triggerType: "manual"
    });

    expect(harness.runs).toHaveLength(1);
    expect(harness.runs[0]?.inputJson).toEqual({
      name: "Anna Nguyen",
      email: "anna@shopabc.vn",
      message: "We need automation.",
      budget: 5000000
    });
    expect(harness.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          input: expect.objectContaining({ name: "Anna Nguyen" }),
          workflowVersionId: "wfv_lead_qualification_v1"
        })
      })
    );
    expect(result.run.workflowVersionId).toBe("wfv_lead_qualification_v1");
  });

  it("keeps free-form input for workflows that do not score leads", async () => {
    const harness = createHarness();

    await harness.service.run("wf_manual_notification", { input: { anything: "goes" }, triggerType: "manual" });

    expect(harness.runs).toHaveLength(1);
    expect(harness.runs[0]?.inputJson).toEqual({ anything: "goes" });
  });

  it("scopes the workflow list to the caller's workspace memberships", async () => {
    const harness = createHarness();

    await harness.service.findAll("ws_demo", "user_1");

    expect(harness.client.workflow.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws_demo",
        workspace: { members: { some: { userId: "user_1" } } },
        status: { not: "ARCHIVED" }
      },
      orderBy: { updatedAt: "desc" }
    });
  });

  it("hides archived workflows from the list unless they are explicitly requested", async () => {
    const harness = createHarness();

    await harness.service.findAll("ws_demo", "user_1", true);

    expect(harness.client.workflow.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_demo", workspace: { members: { some: { userId: "user_1" } } } },
      orderBy: { updatedAt: "desc" }
    });
  });

  it("refuses to run an archived workflow", async () => {
    const harness = createHarness();

    const error = await harness.service
      .run("wf_archived_notification", { input: { anything: "goes" }, triggerType: "manual" })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      message: "Workflow is archived.",
      code: "WORKFLOW_ARCHIVED"
    });
    expect(harness.runs).toHaveLength(0);
    expect(harness.events.publish).not.toHaveBeenCalled();
  });

  it("refuses to publish an archived workflow", async () => {
    const harness = createHarness();

    const error = await harness.service.publish("wf_archived_notification").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      message: "Workflow is archived.",
      code: "WORKFLOW_ARCHIVED"
    });
    expect(harness.client.workflowVersion.create).not.toHaveBeenCalled();
    expect(harness.client.workflow.update).not.toHaveBeenCalled();
  });
});

function createHarness(options: { published?: boolean } = {}) {
  const published = options.published ?? true;
  const now = new Date();
  const versions: Array<{
    id: string;
    workflowId: string;
    versionNumber: number;
    definitionJson: unknown;
    createdById: string;
    createdAt: Date;
  }> = [];
  const workflows = [
    {
      id: "wf_lead_qualification",
      workspaceId: "ws_demo",
      name: "Lead qualification",
      description: "Score a new lead, branch on intent, and send a webhook mock.",
      status: published ? "ACTIVE" : "DRAFT",
      currentVersionId: null as string | null,
      definitionJson: sampleLeadWorkflowDefinition,
      createdById: "user_demo",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "wf_manual_notification",
      workspaceId: "ws_demo",
      name: "Manual notification",
      description: "A workflow that does not score leads.",
      status: "ACTIVE",
      currentVersionId: "wfv_manual_notification_v1" as string | null,
      definitionJson: manualDefinition,
      createdById: "user_demo",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "wf_archived_notification",
      workspaceId: "ws_demo",
      name: "Archived notification",
      description: "A workflow that was archived.",
      status: "ARCHIVED",
      currentVersionId: "wfv_archived_notification_v1" as string | null,
      definitionJson: manualDefinition,
      createdById: "user_demo",
      createdAt: now,
      updatedAt: now
    }
  ];

  if (published) {
    versions.push({
      id: "wfv_lead_qualification_v1",
      workflowId: "wf_lead_qualification",
      versionNumber: 1,
      definitionJson: sampleLeadWorkflowDefinition,
      createdById: "user_demo",
      createdAt: now
    });
    workflows[0]!.currentVersionId = "wfv_lead_qualification_v1";
  }

  versions.push({
    id: "wfv_manual_notification_v1",
    workflowId: "wf_manual_notification",
    versionNumber: 1,
    definitionJson: manualDefinition,
    createdById: "user_demo",
    createdAt: now
  });

  versions.push({
    id: "wfv_archived_notification_v1",
    workflowId: "wf_archived_notification",
    versionNumber: 1,
    definitionJson: manualDefinition,
    createdById: "user_demo",
    createdAt: now
  });

  const runs: Array<{
    id: string;
    workflowId: string;
    workspaceId: string;
    workflowVersionId: string;
    status: string;
    triggerType: string;
    inputJson: unknown;
    triggerEventId: string | null;
    createdAt: Date;
  }> = [];
  const steps: Array<{
    id: string;
    workflowRunId: string;
    nodeId: string;
    nodeType: string;
    status: string;
    errorMessage: string | null;
  }> = [];
  const workflowRunCreate = vi.fn(async ({ data }) => {
    const run = {
      triggerEventId: null,
      createdAt: new Date(),
      ...data
    };
    runs.push(run);
    return run;
  });
  const client = {
    workflow: {
      findUnique: vi.fn(async ({ where }) => workflows.find((workflow) => workflow.id === where.id) ?? null),
      findMany: vi.fn(async () => workflows),
      create: vi.fn(),
      update: vi.fn(async ({ where, data }) => {
        const workflow = workflows.find((candidate) => candidate.id === where.id);
        Object.assign(workflow!, data, { updatedAt: new Date() });
        return workflow;
      })
    },
    workflowVersion: {
      count: vi.fn(async ({ where }) => versions.filter((version) => version.workflowId === where.workflowId).length),
      create: vi.fn(async ({ data }) => {
        const version = { createdAt: new Date(), ...data };
        versions.push(version);
        return version;
      }),
      findUnique: vi.fn(async ({ where }) => versions.find((version) => version.id === where.id) ?? null)
    },
    workflowRun: {
      create: workflowRunCreate,
      update: vi.fn(async ({ where, data }) => {
        const run = runs.find((candidate) => candidate.id === where.id);
        Object.assign(run!, data);
        return run;
      }),
      findMany: vi.fn(async () => runs),
      findUnique: vi.fn(async ({ where, include }) => {
        const run = runs.find((candidate) => candidate.id === where.id);
        if (!run || !include) {
          return run ?? null;
        }
        return {
          ...run,
          workflowVersion: versions.find((version) => version.id === run.workflowVersionId),
          steps: steps.filter((step) => step.workflowRunId === run.id),
          aiTaskResults: [
            { nodeId: "ai-1", provider: "mock", modelName: "gpt-4o-mini", inputTokens: 120, outputTokens: 40 }
          ]
        };
      })
    },
    workflowStepRun: {
      createMany: vi.fn(async ({ data }) => {
        steps.push(...data.map((step) => ({ errorMessage: null, ...step })));
        return { count: data.length };
      })
    },
    workspace: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn(async (callback) => callback(client))
  };
  const events = {
    publish: vi.fn(async (input) => createEvent(input))
  };

  return {
    service: new WorkflowsService(
      events as never,
      { client } as never,
      { ensureDemoWorkflow: vi.fn(async () => undefined), ensureDemoWorkspace: vi.fn(async () => undefined) } as never
    ),
    events,
    client,
    workflowRunCreate,
    runs,
    steps
  };
}
