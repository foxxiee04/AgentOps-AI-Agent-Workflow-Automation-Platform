import { describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { DemoDataService } from "./demo-data.service";

/** The lead template as it looked before the `rejected` edge existed. */
const outdatedLeadDefinition = {
  ...sampleLeadWorkflowDefinition,
  edges: sampleLeadWorkflowDefinition.edges.filter((edge) => edge.id !== "edge-9")
};

type HarnessOptions = {
  /** Definition of the version the workflow currently publishes. */
  publishedDefinition?: unknown;
  /** Id of the published version; `null` means the workflow has no published version. */
  publishedVersionId?: string | null;
  failFirstWorkflowUpsert?: boolean;
};

function createHarness(options: HarnessOptions = {}) {
  const publishedVersionId = options.publishedVersionId === undefined ? "wfv_lead_qualification_v1" : options.publishedVersionId;
  const versions: Array<{
    id: string;
    workflowId: string;
    versionNumber: number;
    definitionJson: unknown;
    createdById: string;
    createdAt: Date;
  }> = [];

  if (publishedVersionId) {
    versions.push({
      id: publishedVersionId,
      workflowId: "wf_lead_qualification",
      versionNumber: 1,
      definitionJson: options.publishedDefinition ?? outdatedLeadDefinition,
      createdById: "user_demo",
      createdAt: new Date()
    });
  }

  let workflowUpserts = 0;
  const client = {
    user: { upsert: vi.fn(async () => ({})) },
    workspace: { upsert: vi.fn(async () => ({ id: "ws_demo" })) },
    workspaceMember: { upsert: vi.fn(async () => ({})) },
    workflow: {
      upsert: vi.fn(async () => {
        workflowUpserts += 1;
        if (options.failFirstWorkflowUpsert && workflowUpserts === 1) throw new Error("db down");
        return {
          id: "wf_lead_qualification",
          workspaceId: "ws_demo",
          status: "ACTIVE",
          currentVersionId: publishedVersionId,
          createdById: "user_demo"
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data
      }))
    },
    workflowVersion: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => versions.find((version) => version.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { workflowId: string } }) =>
        [...versions].reverse().find((version) => version.workflowId === where.workflowId) ?? null
      ),
      count: vi.fn(async ({ where }: { where: { workflowId: string } }) =>
        versions.filter((version) => version.workflowId === where.workflowId).length
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const version = { createdAt: new Date(), ...data };
        versions.push(version as (typeof versions)[number]);
        return version;
      })
    },
    $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run(client))
  };

  return { client, versions };
}

describe("DemoDataService", () => {
  it("writes the demo rows once per process instead of on every request", async () => {
    const { client } = createHarness();
    const service = new DemoDataService({ client } as never);

    await Promise.all([service.ensureDemoWorkflow(), service.ensureDemoWorkflow(), service.ensureDemoWorkspace()]);
    await service.ensureDemoWorkflow();

    expect(client.workflow.upsert).toHaveBeenCalledTimes(1);
    expect(client.workspace.upsert).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure", async () => {
    const { client } = createHarness({ failFirstWorkflowUpsert: true });
    const service = new DemoDataService({ client } as never);

    await expect(service.ensureDemoWorkflow()).rejects.toThrow("db down");
    await expect(service.ensureDemoWorkflow()).resolves.toMatchObject({ id: "wf_lead_qualification" });
    expect(client.workflow.upsert).toHaveBeenCalledTimes(2);
  });

  it("publishes the current lead template when the published version misses the rejected edge", async () => {
    const { client, versions } = createHarness();
    const service = new DemoDataService({ client } as never);

    await service.ensureDemoWorkflow();

    expect(client.workflowVersion.create).toHaveBeenCalledTimes(1);
    expect(client.workflowVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workflowId: "wf_lead_qualification",
        versionNumber: 2,
        definitionJson: expect.objectContaining({
          edges: expect.arrayContaining([expect.objectContaining({ source: "approval-1", target: "notify-1", condition: "rejected" })])
        })
      })
    });

    const created = versions[versions.length - 1]!;
    expect(client.workflow.update).toHaveBeenCalledWith({
      where: { id: "wf_lead_qualification" },
      data: { currentVersionId: created.id, definitionJson: expect.anything(), status: "ACTIVE" }
    });
  });

  it("keeps the current definition when it already carries the rejected edge", async () => {
    const { client } = createHarness({ publishedDefinition: sampleLeadWorkflowDefinition });
    const service = new DemoDataService({ client } as never);

    await service.ensureDemoWorkflow();

    expect(client.workflowVersion.create).not.toHaveBeenCalled();
    expect(client.workflow.update).not.toHaveBeenCalled();
  });

  it("publishes the first version when the demo workflow has no published version", async () => {
    const { client } = createHarness({ publishedVersionId: null });
    const service = new DemoDataService({ client } as never);

    await service.ensureDemoWorkflow();

    expect(client.workflowVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workflowId: "wf_lead_qualification", versionNumber: 1 })
    });
  });

  it("does not query the demo rows again once the workflow is ready", async () => {
    const { client } = createHarness();
    const service = new DemoDataService({ client } as never);

    await service.ensureDemoWorkflow();
    await service.ensureDemoWorkflow();

    expect(client.workflow.upsert).toHaveBeenCalledTimes(1);
    expect(client.workflowVersion.findUnique).toHaveBeenCalledTimes(1);
    expect(client.workflowVersion.create).toHaveBeenCalledTimes(1);
  });

  it("logs the upgrade once", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const { client } = createHarness();
    const service = new DemoDataService({ client } as never);

    await service.ensureDemoWorkflow();

    expect(log).toHaveBeenCalledWith("demo workflow upgraded to the current lead template");
    log.mockRestore();
  });
});
