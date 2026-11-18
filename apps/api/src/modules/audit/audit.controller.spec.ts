import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditController } from "./audit.controller";
import type { AuditService } from "./audit.service";

describe("AuditController", () => {
  let controller: AuditController;
  let service: {
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn()
    };
    controller = new AuditController(service as unknown as AuditService);
  });

  it("delegates to auditService.list with workspaceId and query", async () => {
    const mockResult = { items: [], total: 0, page: 1, pageSize: 30 };
    service.list.mockResolvedValue(mockResult);

    const query = { workspaceId: "ws_demo", page: 1, pageSize: 30, action: "workflow.run" };
    const result = await controller.findAll(query);

    expect(result).toBe(mockResult);
    expect(service.list).toHaveBeenCalledWith("ws_demo", query);
  });
});
