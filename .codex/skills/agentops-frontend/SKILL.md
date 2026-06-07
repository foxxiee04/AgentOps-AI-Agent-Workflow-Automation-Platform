---
name: agentops-frontend
description: Guide AgentOps frontend work. Use when building or reviewing Next.js App Router pages, SaaS landing pages, dashboards, React Flow workflow builder features, frontend state, forms, API integration, or UI documentation in apps/web or packages/ui.
---

# AgentOps Frontend

## Workflow

1. Read `CODEX.md`.
2. Read `apps/web/README.md`.
3. Read `apps/web/DESIGN.md` before writing UI.
4. Read `docs/api.md` and `docs/workflow-engine.md` for product behavior.
5. Inspect existing UI patterns before adding components.
6. Keep feature-specific code in `apps/web/src/features` until reuse is real.

## Product Screens

Prioritize real product surfaces:

- Landing page with workflow automation value.
- Auth pages.
- Dashboard overview.
- Workflow list.
- Workflow builder.
- Workflow run detail and step timeline.
- Agents, integrations, settings, billing, and audit logs.

## Builder Rules

- Use React Flow for graph canvas behavior.
- Validate node config before publish or run.
- Keep local builder state predictable with Zustand or equivalent.
- Use Zod for form/config validation shared with API where practical.
- Represent MVP nodes first: Manual Trigger, AI Agent, Condition, Webhook Mock, End.

## UI Rules

- Keep dashboard screens dense, scannable, and operational.
- Use `apps/web/DESIGN.md` as the visual reference, but keep readability first: sans-serif body text, mono for code/terminal/JSON, high-contrast text, cream canvas, hairline borders, ASCII markers, 4px controls, no gradients or shadows.
- Use loading, empty, error, and disabled states.
- Avoid marketing-only pages when the request asks for an app/tool experience.
- Keep text responsive and avoid layout overlap on mobile and desktop.
