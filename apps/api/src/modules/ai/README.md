# AI Module

Handles AI Agent configs, test-agent endpoint, prompt evaluation, AI task result lookup, and usage reporting.

Endpoints:

- `GET /ai/providers`: provider availability and structured-output support.
- `POST /ai/test-agent`: prompt preview, masking, mock output, JSON Schema validation, and token estimate.
- `POST /ai/evaluate-agent`: deterministic prompt evaluation cases before workflow publish.
- `GET /ai/tasks/:id`: loads the `AiTaskResult` by id from the database, enforces `VIEWER` membership in its workspace (404 when missing, 403 when not a member), and returns `{ id, workflowRunId, nodeId, provider, modelName, inputTokens, outputTokens, output, errorMessage, createdAt }`.
- `GET /ai/usage`: workspace AI usage and quota status.

Rules:

- Validate AI node schemas.
- Enforce workspace quota.
- Store token usage.
- Keep provider secrets server-side only.
- Run real provider calls in `apps/ai-worker`, not directly in the HTTP request path.
