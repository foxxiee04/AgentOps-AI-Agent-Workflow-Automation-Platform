# Notifications Module

Handles in-app notifications and notification status APIs.

The notification worker should create delivery records; the API should expose user/workspace notification views.

Current MVP behavior:

- `GET /notifications` returns in-memory demo and Alertmanager-created notifications.
- `POST /notifications/mark-all-read` marks in-memory notifications as read.
- `POST /notifications/alertmanager` accepts Alertmanager webhook payloads for the local alert bot flow.
- If `ALERT_BOT_WEBHOOK_URL` is configured, alert notifications are forwarded to that external bot webhook with `text`, `content`, and alert metadata fields.
