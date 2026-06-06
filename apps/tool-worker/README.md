# Tool Worker

`apps/tool-worker` executes external-tool style workflow nodes.

## MVP Tools

- Webhook mock node.
- HTTP request mock node.
- Email mock node.

## Responsibilities

- Consume `tool-call-requested`.
- Execute the requested mock/tool action.
- Apply timeout and retry policy.
- Store input, output, status, and errors.
- Publish `tool-call-completed` or `workflow-step-failed`.

## Key Rules

- Restrict HTTP methods to GET and POST in the MVP.
- Use a maximum 10 second timeout.
- Block private/internal IP ranges before implementing real outbound HTTP.

