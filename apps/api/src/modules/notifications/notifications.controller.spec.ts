import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationsController } from "./notifications.controller";
import type { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
    ingestAlertmanagerWebhook: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      markAllRead: vi.fn(),
      ingestAlertmanagerWebhook: vi.fn()
    };
    controller = new NotificationsController(service as unknown as NotificationsService);
  });

  it("findAll delegates to service", async () => {
    service.findAll.mockResolvedValue([{ id: "n1" }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: "n1" }]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it("markAllRead delegates to service", async () => {
    service.markAllRead.mockResolvedValue({ success: true });
    const result = await controller.markAllRead();
    expect(result).toEqual({ success: true });
    expect(service.markAllRead).toHaveBeenCalled();
  });

  it("alertmanager delegates to service", async () => {
    service.ingestAlertmanagerWebhook.mockResolvedValue({ success: true, received: 1, created: 1 });
    const result = await controller.alertmanager({ alerts: [] });
    expect(result).toEqual({ success: true, received: 1, created: 1 });
    expect(service.ingestAlertmanagerWebhook).toHaveBeenCalledWith({ alerts: [] });
  });
});
