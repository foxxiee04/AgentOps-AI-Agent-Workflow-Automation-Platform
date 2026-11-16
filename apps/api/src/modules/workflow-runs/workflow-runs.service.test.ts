import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { sampleLeadWorkflowDefinition, type WorkflowDefinition } from "@agentops/shared";
import { describe, expect, it, vi } from "vitest";
import { WorkflowRunsService } from "./workflow-runs.service";

type Approval = {
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

/** A workflow stored before the `rejected` edge existed: rejecting cancels the run. */
const definitionWithoutRejectedEdge: WorkflowDefinition = {
  ...sampleLeadWorkflowDefinition,
  edges: sampleLeadWorkflowDefinition.edges.filter((edge) => edge.condition !== "rejected")
};

function createHarness(role: string | null = "MEMBER", definition: WorkflowDefinition = sampleLeadWorkflowDefinition) {
  const approval: Approval = {
    id: "apr_1",
    workspaceId: "ws_demo",
    workflowRunId: "run_1",
    nodeId: "approval-1",
    status: "WAITING_APPROVAL",
    payloadJson: { email: { subject: "Hi Anna" } },
    decidedById: null,
    comment: null,
    requestedAt: new Date("2026-10-18T00:00:00Z"),
    decidedAt: null
  };
  const run = {
    id: "run_1",
    workspaceId: "ws_demo",
    workflowId: "wf_lead_qualification",
    status: "WAITING_APPROVAL",
    contextJson: { leadScore: 90, subject: "Hi Anna" },
    workflowVersion: { definitionJson: definition }
  };
  const stepUpdates: unknown[] = [];
  const auditLogs: unknown[] = [];
  const client = {
    workflowRun: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === run.id ? run : null)),
      updateMany: vi.fn(async ({ data }: { data: { status: string } }) => {
        run.status = data.status;
        return { count: 1 };
      })
    },
    workspaceMember: {
      findUnique: vi.fn(async () => (role ? { role } : null))
    },
    humanApproval: {
      findUnique: vi.fn(async () => ({ ...approval })),
      findUniqueOrThrow: vi.fn(async () => ({ ...approval })),
      updateMany: vi.fn(async ({ data }: { data: Partial<Approval> }) => {
        if (approval.status !== "WAITING_APPROVAL") return { count: 0 };
        Object.assign(approval, data);
        return { count: 1 };
      }),
      findMany: vi.fn(async () => [approval])
    },
    workflowStepRun: {
      updateMany: vi.fn(async (args: unknown) => {
        stepUpdates.push(args);
        return { count: 1 };
      })
    },
    auditLog: { create: vi.fn(async (args: unknown) => void auditLogs.push(args)) },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(client))
  };
  const events = { publish: vi.fn(async (input: Record<string, unknown>) => ({ ...input, eventId: "evt_decided" })) };
  const auth = {
    authenticate: vi.fn(async (authorization?: string) => {
      if (!authorization) throw new UnauthorizedException("Missing bearer token");
      return { userId: "user_reviewer", email: "reviewer@agentops.local" };
    })
  };
  const service = new WorkflowRunsService({ client } as never, events as never, auth as never);
  return { service, approval, run, events, stepUpdates, auditLogs, client };
}

describe("WorkflowRunsService.decideApproval", () => {
  it("approves once, audits it and publishes the continuation event with the run context", async () => {
    const harness = createHarness();

    const result = await harness.service.decideApproval("run_1", "run_1_approval-1", { decision: "approve", comment: "ok" }, "Bearer t");

    expect(result.approval).toMatchObject({ status: "APPROVED", decidedById: "user_reviewer", comment: "ok" });
    expect(harness.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "human-approval-decided",
        workflowRunId: "run_1",
        payload: expect.objectContaining({
          nodeId: "approval-1",
          decision: "approve",
          context: { leadScore: 90, subject: "Hi Anna" },
          definition: expect.objectContaining({ nodes: expect.any(Array) })
        })
      })
    );
    expect(harness.auditLogs).toHaveLength(1);
    expect(harness.run.status).toBe("WAITING_APPROVAL");
  });

  it("is idempotent: a second decision returns 409 with the first decision", async () => {
    const harness = createHarness();
    await harness.service.decideApproval("run_1", "approval-1", { decision: "approve" }, "Bearer t");

    const second = harness.service.decideApproval("run_1", "approval-1", { decision: "reject" }, "Bearer t");

    await expect(second).rejects.toBeInstanceOf(ConflictException);
    await expect(second).rejects.toMatchObject({ response: { details: { status: "APPROVED" } } });
    expect(harness.events.publish).toHaveBeenCalledTimes(1);
  });

  it("rejecting cancels the run, fails the step and skips the rest", async () => {
    const harness = createHarness("MEMBER", definitionWithoutRejectedEdge);

    await harness.service.decideApproval("run_1", "approval-1", { decision: "reject", comment: "tone is off" }, "Bearer t");

    expect(harness.run.status).toBe("CANCELLED");
    expect(harness.approval.status).toBe("REJECTED");
    expect(harness.stepUpdates[0]).toMatchObject({ data: { status: "FAILED", errorMessage: "Rejected by reviewer: tone is off" } });
    expect(harness.stepUpdates[1]).toMatchObject({ data: { status: "SKIPPED" } });
    expect(harness.events.publish).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ decision: "reject" }) }));
  });

  it("rejecting a workflow with a rejected edge keeps the run alive for the sales task", async () => {
    const harness = createHarness();

    await harness.service.decideApproval("run_1", "approval-1", { decision: "reject", comment: "tone is off" }, "Bearer t");

    expect(harness.run.status).not.toBe("CANCELLED");
    expect(harness.approval.status).toBe("REJECTED");
    expect(harness.approval.comment).toBe("tone is off");
    // The approval step is done, the pending email step is left to the worker (it is skipped).
    expect(harness.stepUpdates[0]).toMatchObject({ data: { status: "COMPLETED" } });
    expect(harness.stepUpdates.some((update) => (update as { data: { status: string } }).data.status === "SKIPPED")).toBe(false);
    expect(harness.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ decision: "reject", comment: "tone is off" }) })
    );
  });

  it("stores the reviewer's edited email and publishes it", async () => {
    const harness = createHarness();

    await harness.service.decideApproval(
      "run_1",
      "approval-1",
      { decision: "approve", editedEmail: { subject: "Edited subject", body: "Edited body" } },
      "Bearer t"
    );

    expect(harness.approval.payloadJson).toMatchObject({
      email: { subject: "Hi Anna" },
      editedEmail: { subject: "Edited subject", body: "Edited body" }
    });
    expect(harness.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          decision: "approve",
          editedEmail: { subject: "Edited subject", body: "Edited body" }
        })
      })
    );
  });

  it("ignores an edited email on a rejection", async () => {
    const harness = createHarness();

    await harness.service.decideApproval(
      "run_1",
      "approval-1",
      { decision: "reject", comment: "tone is off", editedEmail: { subject: "Edited subject", body: "Edited body" } },
      "Bearer t"
    );

    expect(harness.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ decision: "reject" }) })
    );
    expect((harness.events.publish.mock.calls[0]?.[0] as { payload: Record<string, unknown> }).payload["editedEmail"]).toBeUndefined();
  });

  it("requires a bearer token", async () => {
    const harness = createHarness();
    await expect(harness.service.decideApproval("run_1", "approval-1", { decision: "approve" })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it.each([["VIEWER"], [null]])("forbids role %s", async (role) => {
    const harness = createHarness(role);
    await expect(harness.service.decideApproval("run_1", "approval-1", { decision: "approve" }, "Bearer t")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(harness.approval.status).toBe("WAITING_APPROVAL");
  });

  it("lists pending approvals with their review payload", async () => {
    const harness = createHarness();
    const approvals = await harness.service.listApprovals("ws_demo", undefined, "user_reviewer");
    expect(approvals[0]).toMatchObject({ stepId: "run_1_approval-1", review: { email: { subject: "Hi Anna" } } });
  });

  it("scopes approvals to workspaces the caller belongs to", async () => {
    const harness = createHarness();

    await harness.service.listApprovals(undefined, "WAITING_APPROVAL", "user_reviewer");

    expect(harness.client.humanApproval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflowRun: { workspace: { members: { some: { userId: "user_reviewer" } } } }
        })
      })
    );
  });
});
