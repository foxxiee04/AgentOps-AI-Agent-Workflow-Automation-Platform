import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@agentops/database";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { alertNotificationsTotal } from "../../common/metrics/api-metrics";

type AlertmanagerAlert = {
  status?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  fingerprint?: string;
};

type AlertmanagerWebhook = {
  receiver?: string;
  status?: string;
  alerts?: AlertmanagerAlert[];
  groupLabels?: Record<string, string>;
  commonLabels?: Record<string, string>;
  commonAnnotations?: Record<string, string>;
  externalURL?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.notification.findMany({
      where: { workspaceId: null },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async markAllRead() {
    await this.prisma.client.notification.updateMany({
      where: { workspaceId: null, status: "UNREAD" },
      data: { status: "READ" }
    });

    return { success: true };
  }

  async ingestAlertmanagerWebhook(rawPayload: unknown) {
    const payload = this.normalizeAlertmanagerPayload(rawPayload);
    const alerts = payload.alerts ?? [];
    const createdNotifications: Array<{ title: string; body: string }> = [];

    for (const alert of alerts) {
      const labels = { ...payload.commonLabels, ...alert.labels };
      const annotations = { ...payload.commonAnnotations, ...alert.annotations };
      const alertName = alert.labels?.alertname ?? labels.alertname ?? "AgentOps alert";
      const severity = alert.labels?.severity ?? labels.severity ?? "warning";
      const summary = alert.annotations?.summary ?? annotations.summary;
      const description = alert.annotations?.description ?? annotations.description;
      const body = summary ?? description ?? "Alertmanager delivered an alert to AgentOps.";
      const status = alert.status ?? payload.status ?? "firing";

      // `status` on the row is the read state (UNREAD/READ); the alert state lives in the metadata.
      const metadataJson = {
        alertStatus: status,
        severity,
        labels,
        annotations,
        fingerprint: alert.fingerprint ?? null,
        startsAt: alert.startsAt ?? null,
        endsAt: alert.endsAt ?? null
      };

      await this.prisma.client.notification.create({
        data: {
          type: "ALERT",
          workspaceId: null,
          title: alertName,
          body,
          status: "UNREAD",
          metadataJson: metadataJson as Prisma.InputJsonValue
        }
      });

      alertNotificationsTotal.inc({
        status: payload.status ?? alert.status ?? "unknown",
        severity
      });

      createdNotifications.push({ title: alertName, body });
    }

    if (createdNotifications.length > 0) {
      await this.forwardToExternalBot(payload, createdNotifications);
    }

    return {
      success: true,
      receiver: payload.receiver ?? "unknown",
      received: alerts.length,
      created: createdNotifications.length
    };
  }

  private normalizeAlertmanagerPayload(rawPayload: unknown): AlertmanagerWebhook {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { receiver: "unknown", status: "unknown", alerts: [] };
    }

    const payload = rawPayload as AlertmanagerWebhook;
    return {
      ...payload,
      alerts: Array.isArray(payload.alerts)
        ? payload.alerts.filter((alert): alert is AlertmanagerAlert => alert !== null && typeof alert === "object")
        : []
    };
  }

  private async forwardToExternalBot(payload: AlertmanagerWebhook, notifications: Array<{ title: string; body: string }>) {
    const webhookUrl = process.env.ALERT_BOT_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    const text = notifications.map((notification) => `${notification.title}\n${notification.body}`).join("\n\n");

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          content: text,
          receiver: payload.receiver,
          status: payload.status,
          alerts: notifications
        })
      });
    } catch (error) {
      this.logger.warn(`Failed to forward alert bot webhook: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}
