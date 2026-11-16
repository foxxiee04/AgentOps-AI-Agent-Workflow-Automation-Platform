import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext
} from "@nestjs/common";
import type { WorkspaceRole } from "@agentops/shared";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceRoleGuard, type WorkspaceAuthenticatedUser } from "./workspace-role.guard";
import { WORKSPACE_ROLES_KEY, WORKSPACE_SCOPE_KEY, type WorkspaceScopeSource } from "./workspace-role.decorator";

type HarnessOptions = {
  roles?: WorkspaceRole[];
  scope?: WorkspaceScopeSource;
  membership?: { role: WorkspaceRole } | null;
  workflow?: { workspaceId: string } | null;
  run?: { workspaceId: string } | null;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

function createHarness(options: HarnessOptions = {}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === WORKSPACE_ROLES_KEY) return options.roles;
      if (key === WORKSPACE_SCOPE_KEY) return options.scope;
      return undefined;
    })
  };
  const auth = {
    authenticate: vi.fn(async (authorization?: string) => {
      if (!authorization) throw new UnauthorizedException("Missing bearer token");
      return { userId: "user_1", email: "user@agentops.local" };
    })
  };
  const client = {
    workspaceMember: {
      findUnique: vi.fn(async () => options.membership ?? null)
    },
    workflow: {
      findUnique: vi.fn(async () => options.workflow ?? null)
    },
    workflowRun: {
      findUnique: vi.fn(async () => options.run ?? null)
    }
  };
  const prisma = { client };

  const guard = new WorkspaceRoleGuard(reflector as never, auth as never, prisma as never);
  const request: {
    headers: Record<string, string>;
    params: Record<string, string>;
    body: Record<string, unknown>;
    query: Record<string, unknown>;
    user?: WorkspaceAuthenticatedUser;
  } = {
    headers: options.headers ?? {},
    params: options.params ?? {},
    body: options.body ?? {},
    query: options.query ?? {}
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;

  return { guard, context, request, auth, client };
}

describe("WorkspaceRoleGuard", () => {
  it("allows routes without @WorkspaceRoles without a token", async () => {
    const harness = createHarness({ roles: undefined });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.auth.authenticate).not.toHaveBeenCalled();
  });

  it("rejects a request without a bearer token with 401", async () => {
    const harness = createHarness({ roles: ["MEMBER"], scope: "workspaceParam", params: { id: "ws_1" } });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("forbids a VIEWER on a MEMBER route with 403", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workspaceParam",
      params: { id: "ws_1" },
      headers: { authorization: "Bearer t" },
      membership: { role: "VIEWER" }
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows a MEMBER on a MEMBER route and sets request.user", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workspaceParam",
      params: { id: "ws_1" },
      headers: { authorization: "Bearer t" },
      membership: { role: "MEMBER" }
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.request.user).toEqual({
      userId: "user_1",
      email: "user@agentops.local",
      workspaceId: "ws_1",
      role: "MEMBER"
    });
  });

  it("forbids a MEMBER on an ADMIN route with 403", async () => {
    const harness = createHarness({
      roles: ["ADMIN"],
      scope: "workspaceParam",
      params: { id: "ws_1" },
      headers: { authorization: "Bearer t" },
      membership: { role: "MEMBER" }
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.request.user).toBeUndefined();
  });

  it("ignores the x-workspace-role header and still forbids a VIEWER", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workspaceParam",
      params: { id: "ws_1" },
      headers: { authorization: "Bearer t", "x-workspace-role": "OWNER" },
      membership: { role: "VIEWER" }
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("resolves the workspace from a workflow param", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workflowParamOrBody",
      params: { id: "wf_1" },
      headers: { authorization: "Bearer t" },
      membership: { role: "MEMBER" },
      workflow: { workspaceId: "ws_from_workflow" }
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.client.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "ws_from_workflow", userId: "user_1" } }
    });
    expect(harness.request.user).toMatchObject({ workspaceId: "ws_from_workflow" });
  });

  it("resolves the workspace from a workflow run param", async () => {
    const harness = createHarness({
      roles: ["VIEWER"],
      scope: "runParam",
      params: { id: "run_1" },
      headers: { authorization: "Bearer t" },
      membership: { role: "VIEWER" },
      run: { workspaceId: "ws_from_run" }
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.client.workflowRun.findUnique).toHaveBeenCalledWith({
      where: { id: "run_1" },
      select: { workspaceId: true }
    });
    expect(harness.request.user).toMatchObject({ workspaceId: "ws_from_run" });
  });

  it("returns 404 for an unknown workflow run", async () => {
    const harness = createHarness({
      roles: ["VIEWER"],
      scope: "runParam",
      params: { id: "run_missing" },
      headers: { authorization: "Bearer t" },
      run: null
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("falls back to the body workspace id when there is no workflow param", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workflowParamOrBody",
      body: { workspaceId: "ws_from_body" },
      headers: { authorization: "Bearer t" },
      membership: { role: "MEMBER" }
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.client.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "ws_from_body", userId: "user_1" } }
    });
  });

  it("falls back to the query workspace id when there is no workflow param or body", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workflowParamOrBody",
      query: { workspaceId: "ws_from_query" },
      headers: { authorization: "Bearer t" },
      membership: { role: "MEMBER" }
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.client.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "ws_from_query", userId: "user_1" } }
    });
    expect(harness.request.user).toMatchObject({ workspaceId: "ws_from_query" });
  });

  it("returns 404 for an unknown workflow", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workflowParamOrBody",
      params: { id: "wf_missing" },
      headers: { authorization: "Bearer t" },
      workflow: null
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns 400 when no workspace can be resolved", async () => {
    const harness = createHarness({
      roles: ["MEMBER"],
      scope: "workflowParamOrBody",
      headers: { authorization: "Bearer t" }
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(BadRequestException);
  });
});
