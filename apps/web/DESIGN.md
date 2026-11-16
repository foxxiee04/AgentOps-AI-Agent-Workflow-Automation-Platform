# Design: Lumen

The web app's visual language since 2026-11-17. It replaces the earlier terminal-style direction, which is archived in `design/archive-terminal-ink-DESIGN.md`.

**Idea:** a bright, calm control room. A pearl canvas with a soft aurora wash, white cards that float on layered shadows, deep indigo ink, and one iris gradient reserved for primary actions and the brand mark. Dark surfaces are used sparingly as accents (the landing preview, the workspace card, the closing call to action).

## Tokens

Defined in `src/app/globals.css`. Use the variables, not raw hex values.

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#f6f6fb` | Page background (under the aurora gradients) |
| `--surface-card` | `#ffffff` | Cards, tables, inputs |
| `--surface-soft` | `#f2f2f9` | Table headers, hover fills, quiet panels |
| `--surface-dark` | `#14132b` | Dark accent surfaces (`.lumen-dark`) |
| `--ink-deep` / `--ink` | `#0e0d22` / `#1c1b33` | Headings / text |
| `--body` / `--mute` / `--ash` | `#474962` / `#686b85` / `#a3a6bd` | Body, secondary, disabled |
| `--hairline` / `--hairline-strong` | `rgba(24,22,70,.10)` / `rgba(24,22,70,.26)` | Borders / emphasised borders |
| `--accent` / `--accent-strong` / `--accent-soft` | `#5546f5` / `#4133d6` / `#eeecff` | Links and active states / hover / tinted fills |
| `--accent-gradient` | `#5b4bff → #7c5cff → #a855f7` | Primary buttons, brand mark |
| `--success`, `--warning`, `--danger` (+ `-soft`, `-ink`) | green, amber, rose | Status only |
| `--shadow-sm` / `--shadow-md` / `--shadow-glow` | layered, indigo-tinted | Cards / hovered cards / primary buttons |

Text and background pairs meet WCAG AA. Colour never carries meaning alone: status pills have a dot and a label.

## Typography

- **Be Vietnam Pro** (400 to 800, Latin and Vietnamese) for everything people read.
- **JetBrains Mono** for identifiers, code, JSON and timestamps (`font-mono`).
- Headings use weight 700 to 800 with `-0.02em` tracking; page titles are 30 to 36 px, section titles 16 px, body 15 px.
- Uppercase labels are 11 to 12 px with `0.08em` tracking.

## Shape and depth

- Radius: 12 px for controls (`rounded-xl`), 16 to 20 px for cards (`rounded-2xl`, `.lumen-card`), full for pills.
- Every white bordered surface gets `--shadow-sm` automatically. Interactive cards add `.lumen-card-lift` (rises 3 px, stronger shadow, tinted border).
- The header and the sidebar are glass (`.lumen-glass`): translucent white with blur.

## Components

| Component | Notes |
| --- | --- |
| Primary button | `bg-[var(--accent)]` renders the gradient with a glow; lifts 1 px on hover |
| Secondary button | White, hairline-strong border, accent border and text on hover |
| `MetricCard` | Label, large tabular number with count-up, icon chip, soft colour glow per tone |
| `StatusPill` | Rounded pill with a status dot; tones neutral, success, warning, danger, info |
| Navigation | Active item is a gradient-tinted pill that slides between items with a spring |
| Charts (`dashboard-charts.tsx`) | Server-rendered SVG and CSS: activity bars, outcome donut, lead quality bars |
| Tables | Soft header band, comfortable rows, row hover fill, horizontal scroll inside the card |

## Motion

- Library: `motion` (`motion/react`). Tokens and primitives are in `src/components/motion`.
- Reveal on mount (fade and 8 px rise), staggered lists (at most 8 items), count-up numbers, spring navigation indicator, hover lift on cards and primary buttons.
- The only infinite animations are the "live" pulse dots and cursor.
- `prefers-reduced-motion` removes transforms and loops; fades stay short.

## Rules

- One primary action per view.
- Do not add new raw colours; extend the tokens.
- Keep contact data masked in every screen.
- Check each screen at 390 px, 768 px and 1440 px; there must be no horizontal page scroll.
