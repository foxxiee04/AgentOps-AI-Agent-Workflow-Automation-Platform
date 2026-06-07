# Web App

`apps/web` is the Next.js frontend for AgentOps.

## Responsibilities

- Public landing page.
- Pricing/features/docs public pages.
- Login and register screens.
- Workspace dashboard.
- Workflow list and workflow builder.
- Run history and run detail views.
- Agent, integration, settings, billing, and audit-log pages.

## Planned Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS and `apps/web/DESIGN.md` terminal-native rules
- React Flow for the visual builder
- TanStack Query for server-state fetching
- Zustand for local workflow builder state
- React Hook Form and Zod for forms
- Framer Motion for landing-page motion

## Current Implementation

The web app now renders real product surfaces and calls the NestJS API through `src/lib/api.ts`.

| Route | Backend integration |
| --- | --- |
| `/` | Vietnamese landing page styled from `apps/web/DESIGN.md` with terminal workflow preview. |
| `/vi` and `/en` | Vietnamese and English landing pages. |
| `/login` and `/register` | `POST /auth/login`, `POST /auth/register`, plus Google OAuth entry at `GET /auth/google`. |
| `/auth/callback` | Stores OAuth session fragment returned by the API callback redirect. |
| `/dashboard` | `GET /dashboard/overview`, `GET /dashboard/workflow-runs`, `GET /health/ready`, `GET /ai/providers`, `GET /dashboard/recent-activity`. |
| `/workflows` | `GET /workflows?workspaceId=ws_demo`, `POST /workflows/:id/publish`, `POST /workflows/:id/run`. |
| `/workflows/:id/builder` | `GET /workflows/:id`, React Flow canvas from `workflow.definition`, publish/run actions. |
| `/runs` | `GET /dashboard/workflow-runs`, links each run to its timeline detail. |
| `/runs/:id` | `GET /workflow-runs/:id`, `GET /workflow-runs/:id/steps`, displays run metadata, input payload, and step timeline. |
| `/agents` | `GET /ai/providers`, `GET /ai/usage`, `POST /ai/test-agent`. |
| `/settings` | `GET /health/ready` and runtime configuration summary. |

Server pages use typed fallback data so `next build` still succeeds when the API is offline. Live local demos should start the API on `NEXT_PUBLIC_API_URL` or `http://localhost:4000`.

App routes rendered through `AppShell` are guarded by a browser-side MVP session stored in localStorage. Production auth should move to HttpOnly/SameSite cookies and durable backend sessions or JWT refresh-token rotation.

## E2E Smoke Test

After local infrastructure, API, and web are running, execute:

```bash
pnpm --filter @agentops/web test:e2e
```

The Playwright smoke test clicks through Vietnamese and English landing pages, login, dashboard, workflows, workflow publish/run, run detail timeline, builder inspector, AI console, and settings readiness.

## Suggested Structure

```txt
src/
  app/
    (public)/
    (auth)/
    dashboard/
    workflows/
    runs/
  features/
    workflow-builder/
    workflow-runs/
    workspace/
    auth/
  components/
  lib/
```

## UX Rules

- Build the actual product experience first, not only marketing pages.
- Keep dashboard UI dense, clear, and operational.
- Use React Flow for builder interactions rather than hand-rolling graph behavior.
- Validate workflow node config before sending it to the API.
- Use `apps/web/DESIGN.md` as the source reference. The implementation is terminal-inspired but optimized for readability: sans-serif body text, mono for code/terminal/JSON, cream canvas, ASCII markers, hairline borders, 4px controls, no gradients or shadows.
- Keep Vietnamese and English copy in `src/lib/i18n.ts`.
