import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@agentops/database";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import type { ReportType, UserStatusFilter } from "./dto";

const DAY_MS = 24 * 60 * 60 * 1000;
const GOOGLE_PASSWORD_MARKER = "password-disabled";

type DayCount = { day: string; count: bigint | number | null };
type DaySum = { day: string; total: bigint | number | null };

export type AdminUserItem = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: "password" | "google";
  isPlatformAdmin: boolean;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  workspaces: number;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  passwordHash: string;
  isPlatformAdmin: boolean;
  disabledAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  _count: { memberships: number };
};

/** Platform-wide statistics, account management, audit and CSV reports for the admin console. */
@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async overview(days = 30) {
    const { from, to } = this.range(days);
    const inRange = { gte: from, lte: to };
    const activeSince = new Date(to.getTime() - 7 * DAY_MS);

    const [
      users,
      newUsers,
      activeUsers7d,
      disabledUsers,
      platformAdmins,
      workspaces,
      workflows,
      activeWorkflows,
      runsByStatus,
      approvalsByStatus,
      aiAggregate,
      leadCategories,
      salesTasksOpen,
      salesTasksDone,
      googleUsers
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { createdAt: inRange } }),
      this.db.user.count({ where: { lastLoginAt: { gte: activeSince } } }),
      this.db.user.count({ where: { disabledAt: { not: null } } }),
      this.db.user.count({ where: { isPlatformAdmin: true } }),
      this.db.workspace.count(),
      this.db.workflow.count(),
      this.db.workflow.count({ where: { status: "ACTIVE" } }),
      this.db.workflowRun.groupBy({ by: ["status"], where: { createdAt: inRange }, _count: { _all: true } }),
      this.db.humanApproval.groupBy({ by: ["status"], where: { requestedAt: inRange }, _count: { _all: true } }),
      this.db.aiTaskResult.aggregate({
        where: { createdAt: inRange },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true }
      }),
      this.db.$queryRaw<Array<{ category: string | null; count: bigint }>>(Prisma.sql`
        SELECT "outputJson"->>'category' AS category, COUNT(*) AS count
        FROM "AiTaskResult"
        WHERE "createdAt" BETWEEN ${from} AND ${to} AND "outputJson" ? 'category'
        GROUP BY 1`),
      this.db.notification.count({ where: { type: "SALES_TASK", status: { not: "DONE" }, createdAt: inRange } }),
      this.db.notification.count({ where: { type: "SALES_TASK", status: "DONE", createdAt: inRange } }),
      this.db.user.count({ where: { passwordHash: { endsWith: GOOGLE_PASSWORD_MARKER } } })
    ]);

    const runCount = (status: string) => runsByStatus.find((row) => row.status === status)?._count._all ?? 0;
    const runs = runsByStatus.reduce((sum, row) => sum + row._count._all, 0);
    const runsCompleted = runCount("COMPLETED");
    const runsFailed = runCount("FAILED");
    const finished = runsCompleted + runsFailed;
    const approvalCount = (status: string) => approvalsByStatus.find((row) => row.status === status)?._count._all ?? 0;
    const leadCount = (category: string) => Number(leadCategories.find((row) => row.category === category)?.count ?? 0);

    const [series, topWorkspaces] = await Promise.all([this.dailySeries(from, to, days), this.topWorkspaces(from, to)]);

    return {
      generatedAt: new Date().toISOString(),
      range: { from: from.toISOString(), to: to.toISOString(), days },
      totals: {
        users,
        newUsers,
        activeUsers7d,
        disabledUsers,
        platformAdmins,
        workspaces,
        workflows,
        activeWorkflows,
        runs,
        runsCompleted,
        runsFailed,
        runsActive: runCount("RUNNING") + runCount("PENDING") + runCount("WAITING_APPROVAL"),
        successRate: finished === 0 ? 0 : runsCompleted / finished,
        approvalsApproved: approvalCount("APPROVED"),
        approvalsRejected: approvalCount("REJECTED"),
        approvalsPending: approvalCount("WAITING_APPROVAL"),
        aiCalls: aiAggregate._count._all,
        aiTokens: (aiAggregate._sum.inputTokens ?? 0) + (aiAggregate._sum.outputTokens ?? 0),
        leadsHigh: leadCount("high-intent"),
        leadsLow: leadCount("low-intent"),
        leadsSpam: leadCount("spam"),
        salesTasksOpen,
        salesTasksDone
      },
      series,
      topWorkspaces,
      signupsByProvider: [
        { provider: "password" as const, users: users - googleUsers },
        { provider: "google" as const, users: googleUsers }
      ]
    };
  }

  async listUsers(params: { q?: string; status?: UserStatusFilter; page?: number; pageSize?: number }) {
    const { page, pageSize, skip } = this.paging(params.page, params.pageSize);
    const where: Prisma.UserWhereInput = {
      ...(params.q
        ? {
            OR: [
              { email: { contains: params.q, mode: "insensitive" } },
              { name: { contains: params.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(params.status === "active" ? { disabledAt: null } : {}),
      ...(params.status === "disabled" ? { disabledAt: { not: null } } : {}),
      ...(params.status === "admin" ? { isPlatformAdmin: true } : {})
    };

    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { memberships: true } } }
      }),
      this.db.user.count({ where })
    ]);

    return { items: rows.map((row) => this.toUserItem(row as UserRow)), total, page, pageSize };
  }

  async getUser(id: string) {
    const row = await this.db.user.findUnique({
      where: { id },
      include: {
        _count: { select: { memberships: true } },
        memberships: { orderBy: { joinedAt: "asc" }, include: { workspace: { select: { id: true, name: true } } } }
      }
    });
    if (!row) {
      throw new NotFoundException("User not found");
    }

    return {
      ...this.toUserItem(row as UserRow),
      memberships: row.memberships.map((membership) => ({
        workspaceId: membership.workspace.id,
        workspaceName: membership.workspace.name,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString()
      }))
    };
  }

  async updateUser(actorUserId: string, id: string, dto: { disabled?: boolean; isPlatformAdmin?: boolean }) {
    if (dto.disabled === undefined && dto.isPlatformAdmin === undefined) {
      throw new BadRequestException("Nothing to update");
    }
    if (actorUserId === id) {
      throw new BadRequestException("You cannot change your own account from the admin console");
    }

    const existing = await this.db.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const actions: string[] = [];
    const data: Prisma.UserUpdateInput = {};
    if (dto.disabled !== undefined && dto.disabled !== Boolean(existing.disabledAt)) {
      data.disabledAt = dto.disabled ? new Date() : null;
      actions.push(dto.disabled ? "admin.user.disabled" : "admin.user.enabled");
    }
    if (dto.isPlatformAdmin !== undefined && dto.isPlatformAdmin !== existing.isPlatformAdmin) {
      data.isPlatformAdmin = dto.isPlatformAdmin;
      actions.push(dto.isPlatformAdmin ? "admin.user.admin_granted" : "admin.user.admin_revoked");
    }

    await this.db.$transaction(async (tx) => {
      if (actions.length > 0) {
        await tx.user.update({ where: { id }, data });
      }
      if (dto.disabled === true) {
        // Sign the account out everywhere: refresh tokens die now, access tokens are refused by the auth guard.
        await tx.authRefreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      for (const action of actions) {
        await tx.auditLog.create({
          data: {
            workspaceId: null,
            actorUserId,
            action,
            entityType: "User",
            entityId: id,
            metadataJson: { email: existing.email }
          }
        });
      }
    });

    return this.getUser(id).then(({ memberships: _memberships, ...item }) => item);
  }

  async listWorkspaces(params: { q?: string; page?: number; pageSize?: number }) {
    const { page, pageSize, skip } = this.paging(params.page, params.pageSize);
    const where: Prisma.WorkspaceWhereInput = params.q
      ? { OR: [{ name: { contains: params.q, mode: "insensitive" } }, { slug: { contains: params.q, mode: "insensitive" } }] }
      : {};

    const [rows, total] = await Promise.all([
      this.db.workspace.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          owner: { select: { email: true } },
          _count: { select: { members: true, workflows: true, workflowRuns: true } }
        }
      }),
      this.db.workspace.count({ where })
    ]);
    const tokens = await this.tokensByWorkspace(rows.map((row) => row.id));

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        ownerEmail: row.owner.email,
        members: row._count.members,
        workflows: row._count.workflows,
        runs: row._count.workflowRuns,
        aiTokens: tokens.get(row.id) ?? 0,
        createdAt: row.createdAt.toISOString()
      })),
      total,
      page,
      pageSize
    };
  }

  async listAudit(params: { action?: string; page?: number; pageSize?: number }) {
    const { page, pageSize, skip } = this.paging(params.page, params.pageSize, 30);
    const where: Prisma.AuditLogWhereInput = params.action
      ? { action: { contains: params.action, mode: "insensitive" } }
      : {};

    const [rows, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { actor: { select: { email: true } }, workspace: { select: { name: true } } }
      }),
      this.db.auditLog.count({ where })
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorEmail: row.actor?.email ?? null,
        workspaceName: row.workspace?.name ?? null,
        metadata: (row.metadataJson ?? null) as unknown,
        createdAt: row.createdAt.toISOString()
      })),
      total,
      page,
      pageSize
    };
  }

  /** CSV export; `days` limits time-based rows (users created, runs, usage) to the range. */
  async report(type: ReportType, days = 30): Promise<string> {
    const { from, to } = this.range(days);

    if (type === "users") {
      const rows = await this.db.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { memberships: true } } }
      });
      return toCsv(
        ["id", "email", "name", "provider", "platform_admin", "status", "workspaces", "created_at", "last_login_at"],
        rows.map((row) => {
          const item = this.toUserItem(row as UserRow);
          return [item.id, item.email, item.name, item.provider, item.isPlatformAdmin, item.disabled ? "disabled" : "active", item.workspaces, item.createdAt, item.lastLoginAt ?? ""];
        })
      );
    }

    if (type === "workspaces") {
      const rows = await this.db.workspace.findMany({
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { email: true } }, _count: { select: { members: true, workflows: true, workflowRuns: true } } }
      });
      const tokens = await this.tokensByWorkspace(rows.map((row) => row.id));
      return toCsv(
        ["id", "name", "slug", "owner_email", "members", "workflows", "runs", "ai_tokens", "created_at"],
        rows.map((row) => [row.id, row.name, row.slug, row.owner.email, row._count.members, row._count.workflows, row._count.workflowRuns, tokens.get(row.id) ?? 0, row.createdAt.toISOString()])
      );
    }

    if (type === "runs") {
      const rows = await this.db.workflowRun.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        take: 50_000,
        include: { workflow: { select: { name: true } }, workspace: { select: { name: true } } }
      });
      return toCsv(
        ["id", "workspace", "workflow", "status", "trigger", "created_at", "started_at", "finished_at", "duration_ms", "error"],
        rows.map((row) => [
          row.id,
          row.workspace.name,
          row.workflow.name,
          row.status,
          row.triggerType,
          row.createdAt.toISOString(),
          row.startedAt?.toISOString() ?? "",
          row.finishedAt?.toISOString() ?? "",
          row.startedAt && row.finishedAt ? row.finishedAt.getTime() - row.startedAt.getTime() : "",
          row.errorMessage ?? ""
        ])
      );
    }

    const series = await this.dailySeries(from, to, days);
    return toCsv(
      ["date", "signups", "runs", "runs_failed", "ai_tokens", "approvals"],
      series.map((row) => [row.date, row.signups, row.runs, row.runsFailed, row.aiTokens, row.approvals])
    );
  }

  private async dailySeries(from: Date, to: Date, days: number) {
    const [signups, runs, runsFailed, tokens, approvals] = await Promise.all([
      this.db.$queryRaw<DayCount[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM "User" WHERE "createdAt" BETWEEN ${from} AND ${to} GROUP BY 1`),
      this.db.$queryRaw<DayCount[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM "WorkflowRun" WHERE "createdAt" BETWEEN ${from} AND ${to} GROUP BY 1`),
      this.db.$queryRaw<DayCount[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM "WorkflowRun" WHERE "status" = 'FAILED' AND "createdAt" BETWEEN ${from} AND ${to} GROUP BY 1`),
      this.db.$queryRaw<DaySum[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, SUM("inputTokens" + "outputTokens") AS total
        FROM "AiTaskResult" WHERE "createdAt" BETWEEN ${from} AND ${to} GROUP BY 1`),
      this.db.$queryRaw<DayCount[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', "decidedAt"), 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM "HumanApproval" WHERE "decidedAt" BETWEEN ${from} AND ${to} GROUP BY 1`)
    ]);

    const index = (rows: Array<DayCount | DaySum>) =>
      new Map(rows.map((row) => [row.day, Number("count" in row ? row.count ?? 0 : row.total ?? 0)]));
    const [signupsByDay, runsByDay, failedByDay, tokensByDay, approvalsByDay] = [signups, runs, runsFailed, tokens, approvals].map(index);

    return Array.from({ length: days }, (_, offset) => {
      const date = new Date(from.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
      return {
        date,
        signups: signupsByDay.get(date) ?? 0,
        runs: runsByDay.get(date) ?? 0,
        runsFailed: failedByDay.get(date) ?? 0,
        aiTokens: tokensByDay.get(date) ?? 0,
        approvals: approvalsByDay.get(date) ?? 0
      };
    });
  }

  private async topWorkspaces(from: Date, to: Date) {
    const grouped = await this.db.workflowRun.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { workspaceId: "desc" } },
      take: 5
    });
    if (grouped.length === 0) {
      return [];
    }

    const ids = grouped.map((row) => row.workspaceId);
    const [workspaces, tokens] = await Promise.all([
      this.db.workspace.findMany({ where: { id: { in: ids } }, include: { _count: { select: { members: true } } } }),
      this.tokensByWorkspace(ids, from, to)
    ]);

    return grouped.map((row) => {
      const workspace = workspaces.find((candidate) => candidate.id === row.workspaceId);
      return {
        id: row.workspaceId,
        name: workspace?.name ?? row.workspaceId,
        runs: row._count._all,
        members: workspace?._count.members ?? 0,
        aiTokens: tokens.get(row.workspaceId) ?? 0
      };
    });
  }

  private async tokensByWorkspace(ids: string[], from?: Date, to?: Date) {
    if (ids.length === 0) {
      return new Map<string, number>();
    }
    const rows = await this.db.aiTaskResult.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: ids }, ...(from && to ? { createdAt: { gte: from, lte: to } } : {}) },
      _sum: { inputTokens: true, outputTokens: true }
    });
    return new Map(rows.map((row) => [row.workspaceId, (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0)]));
  }

  private toUserItem(row: UserRow): AdminUserItem {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl ?? undefined,
      provider: row.passwordHash.endsWith(GOOGLE_PASSWORD_MARKER) ? "google" : "password",
      isPlatformAdmin: row.isPlatformAdmin,
      disabled: row.disabledAt !== null,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      workspaces: row._count.memberships
    };
  }

  /** Whole UTC days: the range ends now and starts at 00:00 UTC `days - 1` days ago. */
  private range(days: number) {
    const to = new Date();
    const startOfToday = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return { from: new Date(startOfToday - (days - 1) * DAY_MS), to };
  }

  private paging(page = 1, pageSize = 20, fallbackSize = 20) {
    const size = Math.min(Math.max(pageSize || fallbackSize, 1), 100);
    const current = Math.max(page || 1, 1);
    return { page: current, pageSize: size, skip: (current - 1) * size };
  }
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Vietnamese text correctly; cells starting with =,+,-,@ are quoted with a leading apostrophe to block formula injection. */
export function toCsv(header: string[], rows: Array<Array<string | number | boolean>>): string {
  const cell = (value: string | number | boolean) => {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
