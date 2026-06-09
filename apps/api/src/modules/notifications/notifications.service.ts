import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { alertNotificationsTotal } from "../../common/metrics/api-metrics";

type NotificationView = {
  id: string;
  title: string;
  body: string;
  status: "UNREAD" | "READ";
  severity?: string;
  source?: string;
  createdAt?: string;
};

type AlertmanagerAlert = {
  status?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
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
  private readonly notifications: NotificationView[] = [
    {
      id: "notif_demo",
      title: "Workflow ready",
      body: "Your Lead qualification workflow is ready to publish.",
      status: "UNREAD",
      source: "demo"
    }
  ];

  findAll() {
    return [...this.notifications].reverse();
  }

  markAllRead() {
    for (const notification of this.notifications) {
      notification.status = "READ";
    }

    return { success: true };
  }

  async ingestAlertmanagerWebhook(rawPayload: unknown) {
    const payload = this.normalizeAlertmanagerPayload(rawPayload);
    const alerts = payload.alerts ?? [];
    const created: NotificationView[] = alerts.map((alert) => this.createAlertNotification(alert, payload));

    this.notifications.push(...created);
    for (const notification of created) {
      alertNotificationsTotal.inc({
        status: payload.status ?? "unknown",
        severity: notification.severity ?? "unknown"
      });
    }

    if (created.length > 0) {
      await this.forwardToExternalBot(payload, created);
    }

    return {
      success: true,
      receiver: payload.receiver ?? "unknown",
      received: alerts.length,
      created: created.length
    };
  }

  private normalizeAlertmanagerPayload(rawPayload: unknown): AlertmanagerWebhook {
    if (!rawPayload || typeof rawPayload !== "object") {
      return { receiver: "unknown", status: "unknown", alerts: [] };
    }

    const payload = rawPayload as AlertmanagerWebhook;
    return {
      ...payload,
      alerts: Array.isArray(payload.alerts) ? payload.alerts : []
    };
  }

  private createAlertNotification(alert: AlertmanagerAlert, payload: AlertmanagerWebhook): NotificationView {
    const labels = { ...payload.commonLabels, ...alert.labels };
    const annotations = { ...payload.commonAnnotations, ...alert.annotations };
    const alertName = labels.alertname ?? "AgentOps alert";
    const severity = labels.severity ?? "warning";
    const summary = annotations.summary ?? alertName;
    const description = annotations.description ?? "Alertmanager delivered an alert to AgentOps.";

    return {
      id: `notif_alert_${randomUUID()}`,
      title: `[${severity}] ${summary}`,
      body: `${description} status=${alert.status ?? payload.status ?? "unknown"}`,
      status: "UNREAD",
      severity,
      source: "alertmanager",
      createdAt: new Date().toISOString()
    };
  }

  private async forwardToExternalBot(payload: AlertmanagerWebhook, notifications: NotificationView[]) {
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
