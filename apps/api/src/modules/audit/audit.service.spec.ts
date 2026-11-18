import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditService } from "./audit.service";
import type { PrismaService } from "../../common/infrastructure/prisma.service";

describe("AuditService", () => {
  let service: AuditService;
  let mockPrisma: {
    client: {
      auditLog: {
        findMany: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        auditLog: {
          findMany: vi.fn(),
          count: vi.fn()
        }
      }
    };
    service = new AuditService(mockPrisma as unknown as PrismaService);
  });

  describe("list", () => {
    it("returns scoped and paged audit logs for the workspace", async () => {
      const now = new Date("2026-11-18T12:00:00Z");
      const mockRows = [
        {
          id: "audit_1",
          workspaceId: "ws_123",
          action: "workflow.published",
          entityType: "Workflow",
          entityId: "wf_1",
          metadataJson: { version: 1 },
          createdAt: now,
          actor: { email: "operator@example.com" },
          workspace: { name: "Test Workspace" }
        }
      ];

      mockPrisma.client.auditLog.findMany.mockResolvedValue(mockRows);
      mockPrisma.client.auditLog.count.mockResolvedValue(1);

      const result = await service.list("ws_123", { page: 2, pageSize: 10 });

      expect(mockPrisma.client.auditLog.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123" },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 10,
        include: {
          actor: { select: { email: true } },
          workspace: { select: { name: true } }
        }
      });
      expect(mockPrisma.client.auditLog.count).toHaveBeenCalledWith({
        where: { workspaceId: "ws_123" }
      });

      expect(result).toEqual({
        items: [
          {
            id: "audit_1",
            action: "workflow.published",
            entityType: "Workflow",
            entityId: "wf_1",
            actorEmail: "operator@example.com",
            workspaceName: "Test Workspace",
            metadata: { version: 1 },
            createdAt: now.toISOString()
          }
        ],
        total: 1,
        page: 2,
        pageSize: 10
      });
    });

    it("filters by action when action param is provided", async () => {
      mockPrisma.client.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.client.auditLog.count.mockResolvedValue(0);

      await service.list("ws_123", { action: "user.invited" });

      expect(mockPrisma.client.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws_123",
          action: { contains: "user.invited", mode: "insensitive" }
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 30,
        include: {
          actor: { select: { email: true } },
          workspace: { select: { name: true } }
        }
      });
    });

    it("handles null actor, workspace, and metadata gracefully", async () => {
      const now = new Date("2026-11-18T12:00:00Z");
      const mockRows = [
        {
          id: "audit_2",
          workspaceId: "ws_123",
          action: "system.cleanup",
          entityType: "System",
          entityId: null,
          metadataJson: null,
          createdAt: now,
          actor: null,
          workspace: null
        }
      ];

      mockPrisma.client.auditLog.findMany.mockResolvedValue(mockRows);
      mockPrisma.client.auditLog.count.mockResolvedValue(1);

      const result = await service.list("ws_123");

      expect(result.items[0]).toEqual({
        id: "audit_2",
        action: "system.cleanup",
        entityType: "System",
        entityId: null,
        actorEmail: null,
        workspaceName: null,
        metadata: null,
        createdAt: now.toISOString()
      });
    });
  });
});
