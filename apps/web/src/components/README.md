# Web Components

Local web-only components live here.

Use this folder for layout shells, navigation, app chrome, and one-off composed components. Reusable design-system primitives should move to `packages/ui`.

Current components follow `apps/web/DESIGN.md`:

- `app-shell.tsx`: operational app chrome with ASCII nav markers for dashboard, workflows, runs, builder, agents, and settings.
- `landing-page.tsx`: localized VI/EN landing page.
- `language-switcher.tsx`: app language switcher using the `lang` query parameter.
- `metric-card.tsx`: flat hairline metric block.
- `status-pill.tsx`: 4px status indicator for product states.
