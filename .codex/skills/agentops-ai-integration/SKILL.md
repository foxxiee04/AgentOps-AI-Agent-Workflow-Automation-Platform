---
name: agentops-ai-integration
description: Guide AgentOps AI integration work. Use when implementing or reviewing AI Agent workflow nodes, prompt templates, input mapping, structured JSON output schemas, provider calls, token usage tracking, prompt privacy, AI quotas, or AI worker tests.
---

# AgentOps AI Integration

## Workflow

1. Read `CODEX.md`.
2. Read `docs/ai-agent.md`.
3. Read `docs/security.md` and `docs/workflow-engine.md`.
4. Inspect the AI node config and expected output schema before coding.
5. Add validation and tests for malformed provider output.

## AI Node Rules

- Treat AI as a workflow node, not a chatbot.
- Build prompts from explicit templates and mapped input.
- Require structured JSON output.
- Validate output against the configured schema.
- Retry invalid JSON only within retry limits.
- Store token usage, model metadata, and safe result details.

## Safety Rules

- Do not send secrets, env values, private keys, or unnecessary PII to providers.
- Make prompt/output storage configurable.
- Enforce workspace AI quotas.
- Mask sensitive input when practical.
- Never trust AI output without schema validation.

## Provider Rules

- Keep provider-specific code behind a small abstraction.
- Preserve enough metadata for debugging and cost tracking.
- Fail the workflow step clearly when validation or provider calls fail.

