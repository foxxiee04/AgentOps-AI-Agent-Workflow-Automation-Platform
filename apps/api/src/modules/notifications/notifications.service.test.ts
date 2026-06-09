import { describe, expect, it } from "vitest";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  it("creates in-app notifications from Alertmanager webhooks", async () => {
    const service = new NotificationsService();
    const result = await service.ingestAlertmanagerWebhook({
      receiver: "agentops-alert-bot",
      status: "firing",
      commonLabels: {
        severity: "critical"
      },
      alerts: [
        {
          status: "firing",
          labels: {
            alertname: "AgentOpsApiDown",
            service: "api"
          },
          annotations: {
            summary: "AgentOps API is down",
            description: "Prometheus cannot scrape the API."
          }
        }
      ]
    });

    expect(result).toMatchObject({ success: true, received: 1, created: 1 });
    expect(service.findAll()[0]).toMatchObject({
      source: "alertmanager",
      severity: "critical",
      status: "UNREAD"
    });
  });
});
