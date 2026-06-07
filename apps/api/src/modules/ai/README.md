# AI Module

Handles AI Agent configs, test-agent endpoint, prompt evaluation, AI task result lookup, and usage reporting.

Endpoints:

- `GET /ai/providers`: provider availability and structured-output support.
- `POST /ai/test-agent`: prompt preview, masking, mock output, JSON Schema validation, and token estimate.
- `POST /ai/evaluate-agent`: deterministic prompt evaluation cases before workflow publish.
- `GET /ai/tasks/:id`: mock task status.
- `GET /ai/usage`: mock workspace AI usage.

Rules:

- Validate AI node schemas.
- Enforce workspace quota.
- Store token usage.
- Keep provider secrets server-side only.
- Run real provider calls in `apps/ai-worker`, not directly in the HTTP request path.
