import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@agentops/database";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import type { AuditLogsQueryDto } from "./dto";

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  workspaceName: string | null;
  metadata: unknown;
  createdAt: string;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string, params: Partial<AuditLogsQueryDto> = {}) {
    const { page, pageSize, skip } = this.paging(params.page, params.pageSize, 30);
    const where: Prisma.AuditLogWhereInput = {
      workspaceId,
      ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { actor: { select: { email: true } }, workspace: { select: { name: true } } }
      }),
      this.prisma.client.auditLog.count({ where })
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

  private paging(page = 1, pageSize = 30, fallbackSize = 30) {
    const size = Math.min(Math.max(pageSize || fallbackSize, 1), 100);
    const current = Math.max(page || 1, 1);
    return { page: current, pageSize: size, skip: (current - 1) * size };
  }
}
