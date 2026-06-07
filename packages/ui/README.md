# UI Package

`packages/ui` contains reusable interface primitives for the web app.

Add components here only after reuse is real. Feature-specific UI should stay in `apps/web/src/features` until it is clearly shared.

Reusable components must use `apps/web/DESIGN.md` as reference while keeping readability first: sans-serif body text, mono only where code/terminal treatment is useful, warm cream surfaces, hairline borders, 4px interactive radius, ASCII-friendly labels, no gradients, and no shadows.

Good candidates:

- Buttons and form controls configured for the design system.
- Table primitives.
- Empty states.
- Toast wrappers.
- Status badges.
- Workflow node shell components if reused across builder surfaces.
