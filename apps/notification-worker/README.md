# Notification Worker

`apps/notification-worker` handles notification events.

## Responsibilities

- Consume `notification-requested`.
- Create in-app notifications.
- Optionally create mock email notification records.
- Update notification delivery status.
- Publish completion or failure events if needed.

## Key Rules

- Notifications are workspace scoped.
- Store enough metadata for audit and dashboard display.
- Do not block workflow execution on non-critical notification failures unless the node requires it.

