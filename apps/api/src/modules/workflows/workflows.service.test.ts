import { createEvent } from "@agentops/events";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { describe, expect, it, vi } from "vitest";
import { WorkflowsService } from "./workflows.service";

describe("WorkflowsService", () => {
  it("persists a workflow run before publishing a workflow-triggered event", async () => {
    const harness = createHarness();
    const result = await harness.service.run("wf_lead_qualification", {
      input: { leadName: "Anna" },
      triggerType: "manual"
    });

    expect(result.event.type).toBe("workflow-triggered");
    expect(result.run.workflowVersionId).toMatch(/^wfv_/);
    expect(result.run.eventId).toBe(result.event.eventId);
    expect(harness.runs).toHaveLength(1);
    expect(harness.steps).toHaveLength(5);
    expect(harness.events.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      harness.workflowRunCreate.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("builds a run step timeline from persisted step rows and the immutable workflow version", async () => {
    const harness = createHarness();
    const result = await harness.service.run("wf_lead_qualification", {
      input: { leadName: "Anna" },
      triggerType: "manual"
    });
    const timeline = await harness.service.stepsForRun(result.run.id);

    expect(timeline.workflowRunId).toBe(result.run.id);
    expect(timeline.steps.map((step) => step.nodeId)).toEqual(["trigger-1", "ai-1", "condition-1", "webhook-1", "end-1"]);
    expect(timeline.steps[0]?.status).toBe("COMPLETED");
  });
});

function createHarness() {
  const now = new Date();
  const workflows = [
    {
      id: "wf_lead_qualification",
      workspaceId: "ws_demo",
      name: "Lead qualification",
      description: "Score a new lead, branch on intent, and send a webhook mock.",
      status: "DRAFT",
      currentVersionId: null,
      definitionJson: sampleLeadWorkflowDefinition,
      createdById: "user_demo",
      createdAt: now,
      updatedAt: now
    }
  ];
  const versions: Array<{
    id: string;
    workflowId: string;
    versionNumber: number;
    definitionJson: unknown;
    createdById: string;
    createdAt: Date;
  }> = [];
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
          steps: steps.filter((step) => step.workflowRunId === run.id)
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
    workflowRunCreate,
    runs,
    steps
  };
}
