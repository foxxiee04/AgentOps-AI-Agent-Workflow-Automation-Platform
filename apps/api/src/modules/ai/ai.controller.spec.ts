import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiController } from "./ai.controller";
import type { AiService } from "./ai.service";

describe("AiController", () => {
  let controller: AiController;
  let service: {
    testAgent: ReturnType<typeof vi.fn>;
    evaluateAgent: ReturnType<typeof vi.fn>;
    providers: ReturnType<typeof vi.fn>;
    getTask: ReturnType<typeof vi.fn>;
    usage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      testAgent: vi.fn(),
      evaluateAgent: vi.fn(),
      providers: vi.fn(),
      getTask: vi.fn(),
      usage: vi.fn()
    };
    controller = new AiController(service as unknown as AiService);
  });

  describe("task", () => {
    it("delegates to aiService.getTask with id and caller auth", async () => {
      const mockResult = {
        id: "task_1",
        workflowRunId: "run_1",
        nodeId: "node_1",
        provider: "mock",
        modelName: "mock-model",
        inputTokens: 10,
        outputTokens: 20,
        output: { result: "ok" },
        errorMessage: null,
        createdAt: "2026-11-18T12:00:00.000Z"
      };
      service.getTask.mockResolvedValue(mockResult);

      const auth = { userId: "user_1", email: "user@example.com" };
      const req = { auth };

      const result = await controller.task("task_1", req);

      expect(result).toBe(mockResult);
      expect(service.getTask).toHaveBeenCalledWith("task_1", auth);
    });
  });
});
