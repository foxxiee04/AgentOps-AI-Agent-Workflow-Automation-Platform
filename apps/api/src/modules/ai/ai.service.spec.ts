import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AiService } from "./ai.service";
import type { PrismaService } from "../../common/infrastructure/prisma.service";
import type { DemoDataService } from "../../common/infrastructure/demo-data.service";

describe("AiService", () => {
  let service: AiService;
  let mockPrisma: {
    client: {
      aiTaskResult: {
        findUnique: ReturnType<typeof vi.fn>;
      };
      workspaceMember: {
        findUnique: ReturnType<typeof vi.fn>;
      };
      usageRecord: {
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
    };
  };
  let mockDemoData: {
    ensureDemoWorkspace: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        aiTaskResult: {
          findUnique: vi.fn()
        },
        workspaceMember: {
          findUnique: vi.fn()
        },
        usageRecord: {
          findMany: vi.fn(),
          create: vi.fn()
        }
      }
    };
    mockDemoData = {
      ensureDemoWorkspace: vi.fn().mockResolvedValue({})
    };
    service = new AiService(
      mockPrisma as unknown as PrismaService,
      mockDemoData as unknown as DemoDataService
    );
  });

  describe("getTask", () => {
    const mockAuth = { userId: "user_123", email: "user@example.com" };
    const createdAt = new Date("2026-11-18T10:00:00.000Z");
    const mockTask = {
      id: "ai_task_1",
      workspaceId: "ws_456",
      workflowRunId: "run_789",
      nodeId: "node_ai_scorer",
      provider: "mock",
      modelName: "mock-lead-scorer",
      inputTokens: 150,
      outputTokens: 75,
      promptJson: { test: true },
      outputJson: { category: "high-intent", leadScore: 90 },
      errorMessage: null,
      createdAt
    };

    it("throws 404 when task is not found", async () => {
      mockPrisma.client.aiTaskResult.findUnique.mockResolvedValue(null);

      await expect(service.getTask("non_existent_id", mockAuth)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.client.aiTaskResult.findUnique).toHaveBeenCalledWith({
        where: { id: "non_existent_id" }
      });
      expect(mockPrisma.client.workspaceMember.findUnique).not.toHaveBeenCalled();
    });

    it("throws 403 when caller is not authenticated", async () => {
      mockPrisma.client.aiTaskResult.findUnique.mockResolvedValue(mockTask);

      await expect(service.getTask("ai_task_1", undefined)).rejects.toThrow(ForbiddenException);
    });

    it("throws 403 when caller is not a member of the workspace", async () => {
      mockPrisma.client.aiTaskResult.findUnique.mockResolvedValue(mockTask);
      mockPrisma.client.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.getTask("ai_task_1", mockAuth)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.client.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: "ws_456",
            userId: "user_123"
          }
        }
      });
    });

    it("returns 200 with task details when caller has VIEWER membership", async () => {
      mockPrisma.client.aiTaskResult.findUnique.mockResolvedValue(mockTask);
      mockPrisma.client.workspaceMember.findUnique.mockResolvedValue({
        workspaceId: "ws_456",
        userId: "user_123",
        role: "VIEWER"
      });

      const result = await service.getTask("ai_task_1", mockAuth);

      expect(result).toEqual({
        id: "ai_task_1",
        workflowRunId: "run_789",
        nodeId: "node_ai_scorer",
        provider: "mock",
        modelName: "mock-lead-scorer",
        inputTokens: 150,
        outputTokens: 75,
        output: { category: "high-intent", leadScore: 90 },
        errorMessage: null,
        createdAt: "2026-11-18T10:00:00.000Z"
      });
    });

    it("returns 200 with task details when caller has ADMIN membership", async () => {
      mockPrisma.client.aiTaskResult.findUnique.mockResolvedValue(mockTask);
      mockPrisma.client.workspaceMember.findUnique.mockResolvedValue({
        workspaceId: "ws_456",
        userId: "user_123",
        role: "ADMIN"
      });

      const result = await service.getTask("ai_task_1", mockAuth);
      expect(result.id).toBe("ai_task_1");
      expect(result.output).toEqual({ category: "high-intent", leadScore: 90 });
    });

    it("handles null output and present errorMessage correctly", async () => {
      const failedTask = {
        ...mockTask,
        outputJson: null,
        errorMessage: "Model timeout error"
      };
      mockPrisma.client.aiTaskResult.findUnique.mockResolvedValue(failedTask);
      mockPrisma.client.workspaceMember.findUnique.mockResolvedValue({
        workspaceId: "ws_456",
        userId: "user_123",
        role: "MEMBER"
      });

      const result = await service.getTask("ai_task_1", mockAuth);

      expect(result.output).toBeNull();
      expect(result.errorMessage).toBe("Model timeout error");
    });
  });
});
