import { BadRequestException, ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/infrastructure/prisma.service";
import { AdminService, toCsv } from "./admin.service";
import { PlatformAdminGuard } from "./platform-admin.guard";

function context(auth?: { userId: string; email: string }): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ auth }) }) } as unknown as ExecutionContext;
}

function prismaWith(client: Record<string, unknown>) {
  return { client } as unknown as PrismaService;
}

describe("PlatformAdminGuard", () => {
  const guardFor = (user: { isPlatformAdmin: boolean; disabledAt: Date | null } | null) =>
    new PlatformAdminGuard(prismaWith({ user: { findUnique: vi.fn(async () => user) } }));

  it("rejects requests without a session", async () => {
    await expect(guardFor(null).canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects users who are not platform admins", async () => {
    const guard = guardFor({ isPlatformAdmin: false, disabledAt: null });
    await expect(guard.canActivate(context({ userId: "u1", email: "a@b.c" }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects disabled admins", async () => {
    const guard = guardFor({ isPlatformAdmin: true, disabledAt: new Date() });
    await expect(guard.canActivate(context({ userId: "u1", email: "a@b.c" }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows active platform admins", async () => {
    const guard = guardFor({ isPlatformAdmin: true, disabledAt: null });
    await expect(guard.canActivate(context({ userId: "u1", email: "a@b.c" }))).resolves.toBe(true);
  });
});

describe("AdminService.updateUser", () => {
  const target = {
    id: "u2",
    email: "target@example.com",
    name: "Target",
    avatarUrl: null,
    passwordHash: "x",
    isPlatformAdmin: false,
    disabledAt: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    lastLoginAt: null
  };

  function harness() {
    const tx = {
      user: { update: vi.fn(async () => target) },
      authRefreshToken: { updateMany: vi.fn(async () => ({ count: 2 })) },
      auditLog: { create: vi.fn(async () => ({})) }
    };
    const client = {
      user: {
        findUnique: vi.fn(async (args: { include?: unknown }) =>
          args.include ? { ...target, disabledAt: new Date(), _count: { memberships: 1 }, memberships: [] } : target
        )
      },
      $transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<void>) => fn(tx))
    };
    return { service: new AdminService(prismaWith(client)), tx };
  }

  it("refuses to let an admin change their own account", async () => {
    const { service } = harness();
    await expect(service.updateUser("u2", "u2", { disabled: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an empty update", async () => {
    const { service } = harness();
    await expect(service.updateUser("admin", "u2", {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("disables an account, revokes its refresh tokens and writes a platform audit row", async () => {
    const { service, tx } = harness();
    const result = await service.updateUser("admin", "u2", { disabled: true });

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { disabledAt: expect.any(Date) } });
    expect(tx.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u2", revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: null, actorUserId: "admin", action: "admin.user.disabled", entityId: "u2" })
    });
    expect(result).toMatchObject({ id: "u2", disabled: true });
    expect(result).not.toHaveProperty("memberships");
  });

  it("grants the platform admin flag", async () => {
    const { service, tx } = harness();
    await service.updateUser("admin", "u2", { isPlatformAdmin: true });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { isPlatformAdmin: true } });
    expect(tx.authRefreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "admin.user.admin_granted" }) });
  });
});

describe("toCsv", () => {
  it("quotes separators and neutralises spreadsheet formulas", () => {
    const csv = toCsv(["name", "note"], [["Nguyễn, Văn A", "=HYPERLINK(\"x\")"], ["plain", 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("name,note");
    expect(lines[1]).toBe('"Nguyễn, Văn A","\'=HYPERLINK(""x"")"');
    expect(lines[2]).toBe("plain,3");
  });
});
