# Web Source

Application source for the Next.js web app.

Keep route files in `app/`, feature-specific UI/state in `features/`, reusable local components in `components/`, and small browser/server helpers in `lib/`.

Current structure:

- `app/`: App Router pages. Login/register, dashboard, workflows, runs, builder, agents, and settings are server pages that fetch backend data where needed.
- `features/auth`: client auth forms, local MVP session, Google callback handling, and app route guard.
- `features/workflow-builder`: React Flow canvas and Zustand builder state.
- `features/workflows`: client actions for workflow publish/run API calls.
- `features/workflow-runs`: reserved for richer run timeline interactions once run replay/approval actions are implemented.
- `features/agents`: client AI test console for `/ai/test-agent`.
- `components/`: app shell, metric card, status pill, and local layout primitives.
- `lib/api.ts`: typed API client, fallback data, and browser POST helper.
- `lib/i18n.ts`: Vietnamese/English copy and locale helpers.

UI work must follow `apps/web/DESIGN.md`.
