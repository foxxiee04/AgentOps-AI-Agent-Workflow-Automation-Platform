# Design: Moss Atelier

The web app's visual language since 2026-11-17. The full specification — page-by-page layouts, motion timings, imagery
and the quality budget — is in `design/design-brief.md`; this file is the working summary.

**Idea:** a warm atelier control room. A warm stone canvas with a very soft mist wash, off-white cards on hairline
borders, ink-green text, one moss accent for actions, and a lime tint reserved for live/running states. The look mixes
the hairline grid and mono labels of *Agent Hero (Nova Agent)* with the moss palette, misty light and glass cards of
*Moss Island* (both MotionSites templates), plus a high-contrast serif for a studio feel. There is no purple anywhere.

Directions were picked from the MotionSites templates "Agent Hero" and "Moss Island"; the options page is
`design/template-options.html` and the template gallery is `design/template-gallery.html`.

## Tokens

Defined in `src/app/globals.css`. Use the variables, not raw hex values.

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#F4F3EF` | Page background (warm stone) |
| `--surface-card` | `#FCFBF8` | Cards, sheets, inputs |
| `--surface-soft` | `#EEEDE7` | Sidebar, table header, hover rows |
| `--surface-raised` | `#FFFFFF` | Popovers, menus, focused card |
| `--ink` | `#0F1A14` | Headings, primary text |
| `--body` / `--mute` / `--ash` | `#36413A` / `#66706A` / `#A3AAA4` | Body / secondary / placeholders, disabled |
| `--accent` / `--accent-strong` / `--accent-soft` | `#2F5D3A` / `#244A2E` / `#E4ECE3` | Primary fill, links, active nav, focus ring / hover / selected fills |
| `--live` | `#C6F35C` | Only live/running indicators: dot, underline, chip background with ink text |
| `--mist` | `#E7EBE8` | Hero/auth backdrop base, glass tint |
| `--hairline` / `--hairline-strong` | `rgba(15,26,20,.08)` / `rgba(15,26,20,.18)` | Borders, grid lines / input borders, dividers |
| `--warning` (+ `-soft`, `-ink`) | `#A3620A` / `#FBF1DF` / `#6E4205` | Waiting and approval states |
| `--danger` (+ `-soft`, `-ink`) | `#B4372F` / `#FBEAE7` / `#7A1E18` | Failed and errors |
| `--success` / `--success-soft` | `#2F7A4A` / `#E5F2E8` | Completed |
| `--radius-card` / `--radius-control` | `14px` / `10px` | Cards, panels / buttons, inputs (chips `999px`, mono tags `4px`) |
| `--shadow-sm` / `--shadow-md` | `0 1px 2px rgba(15,26,20,.04), 0 8px 24px -14px rgba(15,26,20,.14)` / `0 2px 6px rgba(15,26,20,.05), 0 28px 60px -28px rgba(15,26,20,.22)` | Resting cards / hover, raised |
| `--glass` | `rgba(252,251,248,.66)` + `backdrop-filter: blur(16px) saturate(1.15)` + 1px `rgba(255,255,255,.6)` border | Nav bar, floating chips, hero preview frame |

The `body` background is the canvas plus a fixed, very soft mist wash (two faint radial gradients in moss and lime, no
colour blobs), with an optional 3% SVG grain overlay.

Text and background pairs meet WCAG AA (ink/body/mute on canvas and card, white on accent, ink on live). Colour never
carries meaning alone.

## Typography

- **Playfair Display** (400/500, italic 400, `vietnamese` subset) for display only: landing headlines, auth headline,
  page titles and big KPI numbers. Instrument Serif was considered and rejected because it has no Vietnamese glyphs.
- **Inter Tight** (400/500/600) for body, UI and everything that is not a display line.
- **JetBrains Mono** (400/500) for mono labels, identifiers, code, JSON, timestamps and table data.
- Load all three with `next/font/google` in `src/app/layout.tsx` (subsets `latin`, `latin-ext`, `vietnamese`) as
  `--font-display`, `--font-sans`, `--font-mono`.
- Scale: landing hero `clamp(48px, 7vw, 104px)`, line-height 1.02, tracking -0.025em; app page title 34px serif;
  h2 `clamp(32px, 4vw, 56px)` serif; h3 20px Inter Tight 600; body 15px (app) / 17px (landing), line-height 1.6,
  max 65ch; small 13px.
- One italic serif word per headline for emphasis.
- Mono labels are 11px, uppercase, `0.14em` tracking, `--mute`, often prefixed with a `+` crosshair or an index
  (`01 /`): eyebrows, table headers, metric labels, node types, timestamps, ids.

## Shape, depth and signature details

- Radius: 14px cards and panels, 10px controls, full for pills, 4px for mono tags. No gradients on buttons.
- Cards: `--surface-card`, 1px `--hairline`, `--radius-card`, `--shadow-sm`; header row = mono label left, action right.
- **Hairline grid**: landing sections sit on a 12-column hairline grid (desktop ≥ 1024px) with small `+` crosshair
  marks at section corners. App pages use a single hairline under the page header and between sections, no heavy boxes.
- **Live chip**: pill with `--live` background, ink text, mono 10.5px uppercase and a 6px ink dot that pulses
  (opacity 0.4→1, 1.6s) only while a status is RUNNING.
- **Status pills**: soft background with ink text (neutral, success, warning, danger), mono 11px uppercase, radius 999px.
- **Buttons**: primary = `--accent` fill, white text, 40px app / 48px landing; secondary = card background with
  `--hairline-strong` border; ghost = text with an underline on hover.
- **Tables**: no zebra; mono header on `--surface-soft`; 52px rows; hover `--surface-soft`; numbers in mono, right
  aligned; horizontal scroll inside the card.
- **Charts** (`dashboard-charts.tsx`): ink and moss scale — series `#2F5D3A`, `#7FA37F`, `#C9D6C6`, with `--live` only
  on the latest/current point; `--hairline` gridlines; mono 11px axis labels.

## Layout

- Landing container max-width 1240px, side padding 24px (16px mobile), section padding 128px desktop / 72px mobile.
- App shell: 248px sidebar on `--surface-soft` with a hairline right border, serif wordmark and small moss hex mark,
  14px nav items with an `--accent-soft` active background, `--accent` text and a 2px left bar, the workspace switcher
  as a card select near the top and the user block at the bottom. Top bar is `--glass`, 64px, mono breadcrumb,
  language switcher and a live AI usage chip. Content max-width 1320px, padding 32px (16px mobile). Below 1024px the
  sidebar becomes a sheet.
- Page header pattern: mono eyebrow (`+ WORKFLOWS`), serif title, one-line muted description, actions right.

## Components

| Component | Notes |
| --- | --- |
| Primary button | `--accent` fill, white text, 10px radius, no gradient |
| Secondary button | Card background, `--hairline-strong` border, accent border and text on hover |
| `MetricCard` | Mono label, large serif tabular number with count-up, small delta, icon chip |
| `StatusPill` | Soft pill with a status dot; tones neutral, success, warning, danger, info |
| Live chip | Lime pill with a pulsing ink dot, only for RUNNING |
| Navigation | Active item is an `--accent-soft` pill with a 2px moss left bar |
| Charts (`dashboard-charts.tsx`) | Server-rendered SVG and CSS: activity bars, outcome donut, lead quality bars |
| Tables | Hairline rows, mono header, 52px height, hover fill, horizontal scroll inside the card |
| Workflow builder (React Flow) | Canvas `--canvas` with a `--hairline` dot grid; node cards 12px radius, mono type label + Inter Tight title; `--accent` 1.5px edges and selection ring |

## Motion

- Library: `motion` (`motion/react`). Tokens and primitives are in `src/components/motion` (`tokens.ts`,
  `reveal.tsx`, `mask-heading.tsx`, `count-up.tsx`, `motion-provider.tsx`); reuse and extend, do not add libraries.
- Easings: entrance `[0.22, 1, 0.36, 1]`, moves `[0.65, 0, 0.35, 1]`, exits `[0.64, 0, 0.78, 0]`.
- Durations: micro 0.2–0.3s, reveal 0.7–0.9s (20px distance), hero ≤ 1.6s total, stagger 0.06–0.1s.
- App pages: page enter fade-up 12px over 0.4s, cards stagger once on mount, no ambient loops except the live chip
  pulse. Landing adds mask-line headlines, a floating workflow object (7s, ±8px), a slow mist drift (24s) and a
  hover-lift on cards.
- `MotionConfig reducedMotion="user"`: marquee, float, gradient drift and pulse off; reveals become opacity only.

## Rules

- One primary action per view.
- Do not add new raw colours; extend the tokens.
- `--live` is for live/running states only — never for decoration or success.
- Keep contact data masked in every screen.
- Animate transform and opacity only; blur only on small elements, once.
- Check each screen at 390px, 768px and 1440px; there must be no horizontal page scroll.
