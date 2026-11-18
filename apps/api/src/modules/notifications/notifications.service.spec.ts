import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationsService } from "./notifications.service";
import type { PrismaService } from "../../common/infrastructure/prisma.service";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let mockPrisma: {
    client: {
      notification: {
        findMany: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        notification: {
          findMany: vi.fn(),
          updateMany: vi.fn(),
          create: vi.fn()
        }
      }
    };
    service = new NotificationsService(mockPrisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns latest 100 platform notifications newest first", async () => {
      const mockNotifications = [
        { id: "n1", workspaceId: null, title: "Alert 1", createdAt: new Date() },
        { id: "n2", workspaceId: null, title: "Alert 2", createdAt: new Date() }
      ];
      mockPrisma.client.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.findAll();

      expect(mockPrisma.client.notification.findMany).toHaveBeenCalledWith({
        where: { workspaceId: null },
        orderBy: { createdAt: "desc" },
        take: 100
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe("markAllRead", () => {
    it("updates platform notifications to READ", async () => {
      mockPrisma.client.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead();

      expect(mockPrisma.client.notification.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: null, status: "UNREAD" },
        data: { status: "READ" }
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("ingestAlertmanagerWebhook", () => {
    it("stores one Notification row per alert and increments counter", async () => {
      mockPrisma.client.notification.create.mockResolvedValue({ id: "n_alert_1" });

      const payload = {
        receiver: "agentops-alert-bot",
        status: "firing",
        commonLabels: { severity: "critical" },
        commonAnnotations: { summary: "Common summary" },
        alerts: [
          {
            status: "firing",
            labels: { alertname: "HighCpuLoad", severity: "critical" },
            annotations: { description: "CPU usage exceeds 90%" },
            fingerprint: "fp123",
            startsAt: "2026-11-18T10:00:00Z",
            endsAt: "2026-11-18T10:30:00Z"
          },
          {
            status: "resolved",
            labels: { alertname: "DiskSpaceLow" },
            annotations: { summary: "Disk space is under 10%" },
            fingerprint: "fp456",
            startsAt: "2026-11-18T09:00:00Z"
          }
        ]
      };

      const result = await service.ingestAlertmanagerWebhook(payload);

      expect(result).toEqual({
        success: true,
        receiver: "agentops-alert-bot",
        received: 2,
        created: 2
      });

      expect(mockPrisma.client.notification.create).toHaveBeenCalledTimes(2);

      expect(mockPrisma.client.notification.create).toHaveBeenNthCalledWith(1, {
        data: {
          type: "ALERT",
          workspaceId: null,
          title: "HighCpuLoad",
          body: "Common summary",
          status: "UNREAD",
          metadataJson: {
            alertStatus: "firing",
            severity: "critical",
            labels: { severity: "critical", alertname: "HighCpuLoad" },
            annotations: { summary: "Common summary", description: "CPU usage exceeds 90%" },
            fingerprint: "fp123",
            startsAt: "2026-11-18T10:00:00Z",
            endsAt: "2026-11-18T10:30:00Z"
          }
        }
      });

      expect(mockPrisma.client.notification.create).toHaveBeenNthCalledWith(2, {
        data: {
          type: "ALERT",
          workspaceId: null,
          title: "DiskSpaceLow",
          body: "Disk space is under 10%",
          status: "UNREAD",
          metadataJson: {
            alertStatus: "resolved",
            severity: "critical",
            labels: { severity: "critical", alertname: "DiskSpaceLow" },
            annotations: { summary: "Disk space is under 10%" },
            fingerprint: "fp456",
            startsAt: "2026-11-18T09:00:00Z",
            endsAt: null
          }
        }
      });
    });

    it("handles payload with no alerts gracefully", async () => {
      const result = await service.ingestAlertmanagerWebhook({});

      expect(result).toEqual({
        success: true,
        receiver: "unknown",
        received: 0,
        created: 0
      });
      expect(mockPrisma.client.notification.create).not.toHaveBeenCalled();
    });
  });
});
