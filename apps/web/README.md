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
- Tailwind CSS and the Lumen design tokens in `apps/web/DESIGN.md`
- React Flow for the visual builder
- TanStack Query for server-state fetching
- Zustand for local workflow builder state
- React Hook Form and Zod for forms
- Framer Motion for landing-page motion

## Current Implementation

The web app now renders real product surfaces and calls the NestJS API through `src/lib/api.ts`.

| Route | Backend integration |
| --- | --- |
| `/` | Vietnamese landing page styled from `apps/web/DESIGN.md` with a workflow runtime preview. |
| `/vi` and `/en` | Vietnamese and English landing pages. |
| `/login` and `/register` | `POST /auth/login`, `POST /auth/register`, plus Google OAuth entry at `GET /auth/google`. |
| `/auth/callback` | Lands after Google OAuth: the API has already set the HttpOnly session cookies; the fragment carries only the user profile and redirect path. |
| `/dashboard` | `GET /dashboard/overview`, `GET /dashboard/workflow-runs`, `GET /health/ready`, `GET /ai/providers`, `GET /dashboard/recent-activity`. |
| `/workflows` | `GET /workflows?workspaceId=ws_demo`, `POST /workflows/:id/publish`, `POST /workflows/:id/run`. |
| `/workflows/:id/builder` | `GET /workflows/:id`, React Flow canvas from `workflow.definition`, publish/run actions. |
| `/runs` | `GET /dashboard/workflow-runs`, links each run to its timeline detail. |
| `/runs/:id` | `GET /workflow-runs/:id`, `GET /workflow-runs/:id/steps`, displays run metadata, input payload, and step timeline. |
| `/agents` | `GET /ai/providers`, `GET /ai/usage`, `POST /ai/test-agent`. |
| `/settings` | `GET /health/ready`, `GET /dashboard/readiness`, and runtime configuration summary. |

Server pages use typed fallback data so `next build` still succeeds when the API is offline. Live local demos should start the API on `NEXT_PUBLIC_API_URL` or `http://localhost:4000`.

## API URL configuration

- `API_PUBLIC_URL` is the runtime, browser-facing API URL. It is read per request and injected into the HTML, so one image can be promoted to another environment.
- `API_INTERNAL_URL` is used for server-side calls that stay inside the cluster (for example `http://api:4000`).
- `NEXT_PUBLIC_API_URL` is only a build-time fallback; Next.js inlines it into the client bundle.

App routes rendered through `AppShell` are guarded by `GET /auth/me`. The session lives in HttpOnly cookies set by the API (`agentops_access`, `agentops_refresh`); the browser never stores tokens. Client calls use `credentials: "include"` and refresh once on 401, and server components forward the incoming Cookie header (`src/lib/server-api.ts`). See `docs/security.md`.

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
- Use `apps/web/DESIGN.md` (Lumen) as the source reference: pearl canvas, white cards with soft shadows, iris gradient for primary actions, Be Vietnam Pro for text and JetBrains Mono for code, IDs and JSON.
- Keep Vietnamese and English copy in `src/lib/i18n.ts`.
