import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { WebhooksService } from "./webhooks.service";

const env = { JWT_REFRESH_SECRET: "test-refresh", API_URL: "http://localhost:4000" };

function hashSecret(secret: string) {
  return createHash("sha256").update(`${env.JWT_REFRESH_SECRET}:${secret}`).digest("hex");
}

type Endpoint = {
  id: string;
  workspaceId: string;
  workflowId: string;
  secretHash: string;
  isActive: boolean;
  createdAt: Date;
};

function endpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: "wh_1",
    workspaceId: "ws_1",
    workflowId: "wf_1",
    secretHash: hashSecret("whsec_test"),
    isActive: true,
    createdAt: new Date("2026-11-18T00:00:00Z"),
    ...overrides
  };
}

function createHarness(options: { role?: string | null; endpoint?: Endpoint } = {}) {
  const stored: Endpoint[] = [];
  const auditLogs: unknown[] = [];
  const workflow = { id: "wf_1", workspaceId: "ws_1" };
  const client = {
    workflow: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === workflow.id ? workflow : null))
    },
    workspaceMember: {
      findUnique: vi.fn(async () => (options.role === null ? null : { role: options.role ?? "ADMIN" }))
    },
    webhookEndpoint: {
      create: vi.fn(async ({ data }: { data: Omit<Endpoint, "id" | "isActive" | "createdAt"> }) => {
        const created = endpoint({ ...data, id: "wh_1", isActive: true, createdAt: new Date("2026-11-18T00:00:00Z") });
        stored.push(created);
        return created;
      }),
      findMany: vi.fn(async ({ where }: { where: { workspaceId: string } }) => stored.filter((row) => row.workspaceId === where.workspaceId)),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        options.endpoint?.id === where.id ? options.endpoint : (stored.find((row) => row.id === where.id) ?? null)
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Endpoint> }) => {
        const target = stored.find((row) => row.id === where.id) ?? options.endpoint;
        if (!target) throw new NotFoundException("Webhook endpoint not found");
        Object.assign(target, data);
        return target;
      })
    },
    auditLog: {
      create: vi.fn(async (args: unknown) => void auditLogs.push(args))
    }
  };
  const workflows = {
    run: vi.fn(async () => ({ run: { id: "run_1", status: "PENDING" }, event: { eventId: "evt_1" } }))
  };
  const config = {
    get: vi.fn((key: string) => (env as Record<string, string | undefined>)[key])
  };
  const service = new WebhooksService({ client } as never, workflows as never, config as never);

  return { service, client, workflows, stored, auditLogs };
}

describe("WebhooksService.create", () => {
  it("returns the secret once and stores only its hash", async () => {
    const harness = createHarness();

    const created = await harness.service.create("wf_1", "user_1");

    expect(created.secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(created).toMatchObject({
      id: "wh_1",
      workflowId: "wf_1",
      workspaceId: "ws_1",
      isActive: true,
      url: "http://localhost:4000/webhooks/wh_1"
    });
    expect(harness.stored).toHaveLength(1);
    expect(harness.stored[0]?.secretHash).toBe(hashSecret(created.secret));
    expect(JSON.stringify(harness.stored[0])).not.toContain(created.secret);
  });

  it("requires ADMIN in the workflow's workspace", async () => {
    const harness = createHarness({ role: "MEMBER" });

    await expect(harness.service.create("wf_1", "user_1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.client.webhookEndpoint.create).not.toHaveBeenCalled();
  });
});

describe("WebhooksService.receive", () => {
  it("starts a webhook-triggered run and audits it", async () => {
    const harness = createHarness({ endpoint: endpoint() });
    const body = { lead: { email: "anna@example.com" } };

    const result = await harness.service.receive("wh_1", "whsec_test", body);

    expect(harness.workflows.run).toHaveBeenCalledWith("wf_1", { input: body, triggerType: "webhook" });
    expect(result).toEqual({ runId: "run_1", status: "PENDING" });
    expect(harness.auditLogs).toEqual([
      {
        data: {
          workspaceId: "ws_1",
          action: "webhook.received",
          entityType: "WebhookEndpoint",
          entityId: "wh_1",
          metadataJson: { workflowId: "wf_1", runId: "run_1" }
        }
      }
    ]);
  });

  it("rejects a wrong secret with 401 and starts nothing", async () => {
    const harness = createHarness({ endpoint: endpoint() });

    await expect(harness.service.receive("wh_1", "whsec_wrong", {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(harness.workflows.run).not.toHaveBeenCalled();
    expect(harness.auditLogs).toHaveLength(0);
  });

  it("rejects a missing secret with 401", async () => {
    const harness = createHarness({ endpoint: endpoint() });

    await expect(harness.service.receive("wh_1", undefined, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns 404 for an inactive endpoint", async () => {
    const harness = createHarness({ endpoint: endpoint({ isActive: false }) });

    await expect(harness.service.receive("wh_1", "whsec_test", {})).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.workflows.run).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown endpoint", async () => {
    const harness = createHarness();

    await expect(harness.service.receive("wh_missing", "whsec_test", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([["a string"], [null], [[1, 2, 3]]])("rejects a non-object body %j with 400", async (body) => {
    const harness = createHarness({ endpoint: endpoint() });

    await expect(harness.service.receive("wh_1", "whsec_test", body)).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.workflows.run).not.toHaveBeenCalled();
  });
});

describe("WebhooksService.list", () => {
  it("returns the workspace endpoints without secrets", async () => {
    const harness = createHarness();
    harness.stored.push(endpoint(), endpoint({ id: "wh_2", workflowId: "wf_2" }));

    const endpoints = await harness.service.list("ws_1");

    expect(endpoints).toHaveLength(2);
    for (const item of endpoints) {
      expect(item).not.toHaveProperty("secret");
      expect(item).not.toHaveProperty("secretHash");
      expect(item.url).toBe(`http://localhost:4000/webhooks/${item.id}`);
    }
  });
});

describe("WebhooksService.deactivate", () => {
  it("keeps the endpoint but disables it for ADMIN", async () => {
    const harness = createHarness();
    harness.stored.push(endpoint());

    const disabled = await harness.service.deactivate("wh_1", "user_1");

    expect(disabled).toMatchObject({ id: "wh_1", isActive: false });
    expect(harness.stored[0]?.isActive).toBe(false);
    expect(harness.client.webhookEndpoint.update).toHaveBeenCalledWith({ where: { id: "wh_1" }, data: { isActive: false } });
  });
});
