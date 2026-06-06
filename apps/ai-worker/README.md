# AI Worker

`apps/ai-worker` executes AI Agent node tasks.

## Responsibilities

- Consume `agent-task-requested`.
- Build prompts from node config and mapped input.
- Call OpenAI or Gemini provider.
- Parse and validate structured JSON output.
- Store AI result, token usage, model metadata, and errors.
- Publish `agent-task-completed` or `workflow-step-failed`.

## Key Rules

- Never send secrets or private environment values to providers.
- Validate output against the node schema.
- Retry invalid JSON only within configured limits.
- Respect workspace AI quota.

