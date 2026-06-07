# Web Lib

Small frontend helpers live here.

Good candidates:

- API client setup.
- route helpers.
- auth/session helpers.
- query-key helpers.
- formatting utilities.

`api.ts` is the current API boundary for the web app. It exports:

- `apiGet` and `safeApiGet` for server pages.
- `clientApiPost` for browser actions.
- typed response shapes for dashboard, workflows, workflow runs, health, and AI endpoints.
- stable fallback data for offline builds and local demos.

`i18n.ts` exports:

- supported locales: `vi`, `en`.
- landing page copy for `/`, `/vi`, and `/en`.
- app shell/page copy for `?lang=vi` and `?lang=en`.
- locale normalization helpers for server pages.
