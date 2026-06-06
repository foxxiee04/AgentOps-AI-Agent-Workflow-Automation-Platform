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
- Tailwind CSS and shadcn/ui
- React Flow for the visual builder
- TanStack Query for server-state fetching
- Zustand for local workflow builder state
- React Hook Form and Zod for forms
- Framer Motion for landing-page motion

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

