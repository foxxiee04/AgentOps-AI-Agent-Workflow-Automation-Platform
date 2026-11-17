# Design brief - AgentOps web app

Chosen direction: **C · Moss Atelier** (2026-11-17). Options page: `design/template-options.html`.
It mixes the technical hairline grid and mono labels of *Agent Hero (Nova Agent)* with the moss palette, misty light
and glass cards of *Moss Island*, plus a high-contrast serif for a studio feel.
References: MotionSites "Agent Hero" and "Moss Island" (https://motionsites.ai/). Recreate the look in our own code;
do not copy their assets.

Replaces the "Lumen" look (`apps/web/DESIGN.md`, iris gradient, Be Vietnam Pro). No purple anywhere.

## Tokens (CSS variables in `apps/web/src/app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#F4F3EF` | page background (warm stone) |
| `--surface-card` | `#FCFBF8` | cards, sheets, inputs |
| `--surface-soft` | `#EEEDE7` | sidebar, table header, hover rows |
| `--surface-raised` | `#FFFFFF` | popovers, menus, focused card |
| `--ink` | `#0F1A14` | headings, primary text |
| `--body` | `#36413A` | body copy |
| `--mute` | `#66706A` | secondary text, labels |
| `--ash` | `#A3AAA4` | placeholders, disabled |
| `--accent` | `#2F5D3A` | primary button fill, links, active nav, focus ring |
| `--accent-strong` | `#244A2E` | primary hover/pressed |
| `--accent-soft` | `#E4ECE3` | selected rows, active nav background, soft badges |
| `--live` | `#C6F35C` | ONLY live/running indicators and tiny highlights (dot, underline, chip background with ink text) |
| `--mist` | `#E7EBE8` | hero/auth backdrop base, glass tint |
| `--hairline` | `rgba(15, 26, 20, 0.08)` | 1px borders, grid lines |
| `--hairline-strong` | `rgba(15, 26, 20, 0.18)` | input borders, dividers that must read |
| `--warning` / `--warning-soft` / `--warning-ink` | `#A3620A` / `#FBF1DF` / `#6E4205` | waiting/approval states |
| `--danger` / `--danger-soft` / `--danger-ink` | `#B4372F` / `#FBEAE7` / `#7A1E18` | failed/errors |
| `--success` / `--success-soft` | `#2F7A4A` / `#E5F2E8` | completed |
| `--radius-card` | `14px` | cards, panels |
| `--radius-control` | `10px` | buttons, inputs, selects; chips `999px`; mono tags `4px` |
| `--shadow-sm` | `0 1px 2px rgba(15,26,20,.04), 0 8px 24px -14px rgba(15,26,20,.14)` | resting cards |
| `--shadow-md` | `0 2px 6px rgba(15,26,20,.05), 0 28px 60px -28px rgba(15,26,20,.22)` | hover/raised |
| `--glass` | `rgba(252, 251, 248, 0.66)` + `backdrop-filter: blur(16px) saturate(1.15)` + 1px `rgba(255,255,255,.6)` border | nav bar, floating chips, hero preview frame |

All text/background pairs must meet WCAG AA (ink/body/mute on canvas and card; white on accent; ink on live).

Background of `body`: canvas plus a very soft mist wash (no colour blobs):
`radial-gradient(70rem 40rem at 85% -10%, rgba(47,93,58,.07), transparent 60%), radial-gradient(60rem 36rem at 0% 0%, rgba(198,243,92,.06), transparent 55%), var(--canvas)`, fixed. Optional 3% grain overlay (SVG noise, pointer-events none).

## Typography

- Display: **Playfair Display** 400/500 + italic 400 (Instrument Serif has no Vietnamese glyphs; Playfair has the
  `vietnamese` subset). Body/UI: **Inter Tight** 400/500/600. Mono labels/data: **JetBrains Mono** 400/500.
  Load all three with `next/font/google` in `apps/web/src/app/layout.tsx` with subsets `latin`, `latin-ext`,
  `vietnamese`; expose as `--font-display`, `--font-sans`, `--font-mono`.
- Scale: landing hero `clamp(48px, 7vw, 104px)`, line-height 1.02, tracking -0.025em; page title (app) 34px serif
  line-height 1.1; h2 `clamp(32px, 4vw, 56px)` serif; h3 20px Inter Tight 600; body 15px (app) / 17px (landing),
  line-height 1.6, max 65ch; small 13px.
- Serif is for display only: landing headlines, auth headline, page titles, big KPI numbers. Everything else is Inter Tight.
- Italic serif for one emphasised word per headline (e.g. "Quy trình AI *chạy thật*").
- Mono labels: 11px, uppercase, letter-spacing 0.14em, colour `--mute`, often prefixed with a small `+` crosshair or
  index (`01 /`). Use for eyebrows, table headers, metric labels, node types, timestamps, ids.

## Signature details (apply consistently)

- **Hairline grid**: landing sections sit on a 12-column hairline grid (vertical lines `--hairline` at column edges,
  visible only on desktop ≥ 1024px), with small `+` crosshair marks (8px, 1px stroke, `--hairline-strong`) at section
  corners. App pages: a single hairline under the page header and between sections, no heavy boxes.
- **Live chip**: pill with `--live` background, ink text, mono 10.5px uppercase, a 6px ink dot that pulses (opacity
  0.4→1, 1.6s) when the status is RUNNING. Only for live/running states.
- **Status pills**: soft background + ink-coloured text (success/warning/danger/neutral), mono 11px uppercase, radius 999px.
- **Buttons**: primary = `--accent` fill, white text, radius 10px, height 40px (app) / 48px (landing), Inter Tight 500;
  secondary = card background + `--hairline-strong` border; ghost = text + underline on hover. No gradients on buttons.
- **Cards**: `--surface-card`, 1px `--hairline`, `--radius-card`, `--shadow-sm`; header row = mono label left, action right.
- **Tables**: no zebra; header row mono labels on `--surface-soft`; rows 52px; hover `--surface-soft`; numbers in mono, right aligned.
- **Charts** (dashboard): ink and moss scale — series 1 `#2F5D3A`, series 2 `#7FA37F`, series 3 `#C9D6C6`,
  highlight `--live` for the latest/current point only; gridlines `--hairline`; axis labels mono 11px `--mute`.

## Layout

- Landing container max-width 1240px, side padding 24px (16px mobile), section padding 128px desktop / 72px mobile.
- App shell: left sidebar 248px on `--surface-soft` with hairline right border; brand (serif wordmark "AgentOps" +
  small moss hex mark) at top; nav items Inter Tight 14px, icon 18px, active item = `--accent-soft` background +
  `--accent` text + 2px left bar in `--accent`; workspace switcher (existing) styled as a card select at the top of
  the sidebar; user block at the bottom. Top bar: glass, 64px, page breadcrumb in mono + language switcher + live AI
  usage chip. Content max-width 1320px, padding 32px (16px mobile). Mobile (< 1024px): sidebar becomes a sheet.
- Page header pattern: mono eyebrow (`+ WORKFLOWS`), serif title, one-line muted description, actions right.

## Pages

### 1. Landing (`src/app/page.tsx` -> `src/components/landing-page.tsx`, locales vi/en)
- **Nav**: glass bar, serif wordmark left, links center (mono 11px uppercase), "Đăng nhập" ghost + "Bắt đầu" primary right.
- **Hero**: left 7 cols: mono eyebrow `+ WORKFLOW AUTOMATION`, serif headline 2 lines with one italic word, 17px
  subtext, CTAs. Right 5 cols: a floating "workflow object": 4 stacked glass node cards (Trigger → AI chấm điểm →
  Duyệt → Tạo task) connected by a thin moss line, the AI card shows a live chip and a score count-up; whole object
  floats (ambient, 7s, ±8px) over a slow mist gradient drift (24s). Thin hairline grid + crosshairs behind.
  Motion: `mask-lines` on the headline (0.9s, EASE_OUT, stagger 0.08), `blur-in` on subtext (delay .3) and CTAs
  (delay .4), node cards `stagger` (0.08) with `scale-in` 0.96→1; total ≤ 1.6s.
- **Proof strip**: mono marquee of node types/integrations (Kafka · Postgres · OpenAI · Redis · Webhook · Approval ·
  Sales task), edge fade, pauses on hover, off for reduced motion.
- **How it works**: 3 numbered columns (`01 /`, `02 /`, `03 /`) on the hairline grid with serif h3; `stagger` reveal.
- **Bento features**: 2×3 bento of cards (run timeline, human approval, AI scoring, observability, RBAC, CI/CD), each
  with a tiny live UI fragment; `hover-lift` (y -4px, shadow-md, 0.25s).
- **Dashboard preview**: large glass frame with a screenshot-like composed dashboard (real components, static data),
  `scale-in` 1.04→1 on view.
- **CTA + footer**: serif statement, primary CTA, footer with hairline top, mono small print.

### 2. Auth (`src/app/login`, `src/app/register`, `src/features/auth/*`)
- Split screen: left = mist panel with serif headline, the floating workflow object (reuse from landing, smaller) and
  3 mono bullet points; right = card form (max 400px): serif title, Google button first (white card button with the
  Google "G" logo, full width), divider "hoặc" in mono, email/password inputs (44px, radius 10px, hairline-strong
  border, focus ring 3px `--accent-soft` + border `--accent`), primary submit. Errors in `--danger-ink` on `--danger-soft`.

### 3. App pages (dashboard, runs, approvals, workflows, workflow builder, agents, settings)
- Apply the shell, page header pattern, cards, tables, status pills and chart palette above. Keep every feature and
  data flow exactly as it is; this is a visual redesign only.
- Dashboard: KPI row of 4 cards (mono label, serif 40px number with `counter`, small delta); charts in cards; lead
  table; sales task list; recent activity as a hairline timeline.
- Runs: filter bar as a hairline row of selects; table; run detail timeline = vertical hairline with step nodes
  (completed moss dot, running live chip, failed danger dot).
- Approvals: queue cards with the drafted email in a paper-like inner panel (serif subject line), approve = primary,
  reject = secondary danger text.
- Workflow builder (React Flow): canvas `--canvas` with dot grid `--hairline`; nodes = cards radius 12px, mono type
  label + Inter Tight title; edges `--accent` 1.5px; selected node ring `--accent`.

## Motion system
- Library `motion` (`motion/react`), existing primitives in `src/components/motion/` (`tokens.ts`, `reveal.tsx`,
  `mask-heading.tsx`, `count-up.tsx`, `motion-provider.tsx`): reuse and extend, do not add new libraries.
- Easings: entrance `[0.22, 1, 0.36, 1]`; moves `[0.65, 0, 0.35, 1]`; exits `[0.64, 0, 0.78, 0]`.
- Durations: micro 0.2–0.3s, reveal 0.7–0.9s (distance 20px), hero ≤ 1.6s total, stagger 0.06–0.1s.
- App pages: page enter fade-up 12px 0.4s; cards `stagger` once on mount; no ambient loops inside the app except the
  live chip pulse.
- Reduced motion (`MotionConfig reducedMotion="user"`): marquee, float, gradient drift and pulse off; reveals = opacity.

## Imagery & assets
- No stock photos. Visual interest comes from the composed workflow object, glass, hairline grid and type.
- Icons: existing itshover icon set in `src/icons/`, stroke 1.5, colour inherits; animate on parent hover.
- Brand mark: small hexagon outline in `--accent` with a `--live` leaf/dot (inline SVG), next to the serif wordmark.

## Quality budget
- LCP < 2.5s, CLS < 0.1; animate transform/opacity only; blur only on small elements once.
- AA contrast, visible focus states (`--accent` ring), all controls keyboard reachable, `prefers-reduced-motion` respected.
- Existing unit tests and e2e scenarios must keep passing (update selectors only when text/markup legitimately changed).
