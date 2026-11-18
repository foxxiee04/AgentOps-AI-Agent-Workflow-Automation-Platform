# Notifications Module

Handles in-app notifications, platform alert feeds, and notification status APIs.

The notification worker creates delivery records for workflow notifications (`SALES_TASK`); this module handles platform-level alerts and notifications.

## Endpoints

- `GET /notifications`: Returns the latest 100 platform notifications (`workspaceId` null) from PostgreSQL, newest first. Restricted to platform administrators via `PlatformAdminGuard`.
- `POST /notifications/mark-all-read`: Updates all platform notifications to `READ` status. Restricted to platform administrators via `PlatformAdminGuard`.
- `POST /notifications/alertmanager`: Public webhook endpoint (Bearer token protected via `ALERTMANAGER_WEBHOOK_TOKEN` in non-local environments) that ingests Prometheus Alertmanager alerts.
  - Persists each alert as a `Notification` row in PostgreSQL with `type: "ALERT"`, `workspaceId: null`, `title: alertname`, `body: summary/description`, `status: alert status`, and `metadataJson` (`labels`, `annotations`, `fingerprint`, `startsAt`, `endsAt`).
  - Increments the `agentops_alertmanager_notifications_total` Prometheus counter.
  - If `ALERT_BOT_WEBHOOK_URL` is configured, alert notifications are forwarded to that external bot webhook with `text`, `content`, and alert metadata fields.
