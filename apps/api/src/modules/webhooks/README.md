# Webhooks Module

Manages `WebhookEndpoint` records and exposes the public inbound trigger used by external systems.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/webhooks` | JWT, `ADMIN` in the workflow's workspace | Create an endpoint for `{ workflowId }`. Returns the endpoint plus a one-time `whsec_…` secret. |
| `GET` | `/webhooks?workspaceId=` | JWT, `VIEWER` in the workspace | List endpoints without secrets. |
| `DELETE` | `/webhooks/:id` | JWT, `ADMIN` in the endpoint's workspace | Deactivate (`isActive = false`) an endpoint. |
| `POST` | `/webhooks/:id` | Public + `x-agentops-webhook-secret` | Start a run of the endpoint's workflow. Responds `202 { runId, status }`. |

The endpoint URL returned by `POST /webhooks` is `${API_URL}/webhooks/<id>`.

## Secret handling

- The secret is `whsec_` followed by 32 random bytes encoded as base64url.
- Only a salted SHA-256 hash (the same scheme used for refresh tokens) is stored in `secretHash`.
- Inbound requests hash the supplied header value and compare it with `secretHash` in constant time.
- Unknown or inactive endpoints return `404`; a missing or wrong secret returns `401`.

## Inbound request

- Body must be a JSON object (`400` otherwise); it is passed to `WorkflowsService.run` as
  `{ input: body, triggerType: "webhook" }`.
- Successful calls write a `webhook.received` audit row with `entityType: "WebhookEndpoint"`.
- The route is `@Public()` and cookie-less, so the CSRF Origin guard does not apply. Per-IP throttling
  still applies through the global throttler.
