# App Routes

Next.js App Router routes live here.

Planned route groups:

- `(public)`: landing, pricing, features, docs.
- `(auth)`: login and register.
- `dashboard`: SaaS dashboard.
- `workflows`: workflow list, new workflow, builder, runs.
- `runs`: workflow run detail pages.

Implemented routes:

- `/`: Vietnamese landing page with terminal preview.
- `/vi` and `/en`: Vietnamese and English landing variants.
- `/login` and `/register`: client auth forms using the NestJS auth endpoints.
- `/auth/callback`: client OAuth callback session storage.
- `/dashboard`: server page reading dashboard, health, AI provider, and event endpoints.
- `/workflows`: server page reading workflow list with client publish/run actions.
- `/workflows/[id]/builder`: server page loading workflow detail into React Flow.
- `/runs`: server page reading workflow run history.
- `/runs/[id]`: server page reading run metadata and generated step timeline.
- `/agents`: server page plus client AI test console.
- `/settings`: server page for API readiness and runtime decisions.
