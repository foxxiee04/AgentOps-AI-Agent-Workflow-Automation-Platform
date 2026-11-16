# Design brief - AgentOps web app

> **Superseded on 2026-11-17.** The app now follows the **Lumen** direction described in `apps/web/DESIGN.md` (bright pearl canvas, iris gradient accent, soft shadows, Be Vietnam Pro). The motion tokens, primitives and icon choices below are still in use; the "Terminal Ink" look (monospace everywhere, no shadows or gradients, ASCII markers) is not. The old look reference is `design/archive-terminal-ink-DESIGN.md`.

Chosen direction: **A - Terminal Ink** (keep `apps/web/DESIGN.md`, add calm motion and animated icons). Options page: design/template-options.html (chosen 2026-10-22).
References: apps/web/DESIGN.md (source of truth for look), https://www.itshover.com/icons (icons, Apache-2.0, copied into `apps/web/src/icons/`), premium-motion skill (motion tokens and recipes), https://bklit.com/blocks (stat card idea only; sparklines are a later step, they need a time-series API).

Principle: **the look does not change**. Same cream canvas, near-black ink, monospaced text everywhere, hairline borders, 4px radius, no gradients, no card shadows, `[+] [ok] [!] [~]` markers. Motion and icons only make state changes and navigation easier to follow. Nothing loops except the single "live" cursor.

## Tokens (already in apps/web/src/app/globals.css - keep them)
| Token | Value | Use |
|---|---|---|
| --canvas | #fdfcfc | page background |
| --surface-soft | #f8f7f7 | panels, table headers |
| --surface-card | #ffffff | cards |
| --ink | #201d1d | text |
| --mute | #646262 | secondary text |
| --accent | #0056b3 | primary buttons, active nav, links (AA on white) |
| --hairline | rgba(15,0,0,0.12) | borders |
| --hairline-strong | #646262 | hover/active border |
| radius | 4px | every interactive element and card |
| shadow | none | never |

## Typography
- One family: **JetBrains Mono** (Google Fonts, `next/font/google`, subsets `latin` + `vietnamese`, weights 400/500/700, `display: "swap"`, CSS variable `--font-mono`). Keep "Berkeley Mono" first in the stack only if installed locally; JetBrains Mono is the loaded default.
- Scale (unchanged): page title 28-38px bold, section heading 16px bold, body 15px, small 12-13px; line-height 1.5; letter-spacing 0.

## Layout
- Unchanged desktop layout (sidebar 240px + main). Fix: between 640 and 1023px the page overflows horizontally (seen at 800px) - make the main column `min-w-0`, tables `overflow-x-auto`, header chips wrap, sidebar collapses to the top nav already used on mobile below 1024px.

## Motion system
- Library: `motion` (import from "motion/react"), replacing the unused `framer-motion` dependency. No Lenis (app, not a scroll story).
- Tokens (`apps/web/src/components/motion/tokens.ts`): EASE_OUT [0.22, 1, 0.36, 1]; EASE_IN [0.64, 0, 0.78, 0]; micro 0.2s; base 0.35s; reveal 0.5s; stagger 0.05s (max 8 items staggered, the rest appear with the last one); distance 8px (terminal = small moves).
- `MotionProvider` = `<MotionConfig reducedMotion="user">` wrapping the app in providers.tsx. With reduced motion every transform is dropped; opacity fades stay at 0.15s.
- Primitives in `apps/web/src/components/motion/`:
  - `Reveal` / `Stagger` + `StaggerItem` - fade + y 8px -> 0 on first mount (not on every refetch), `once` semantics.
  - `MaskHeading` - page title rises from an overflow-hidden mask (y 100% -> 0, 0.5s EASE_OUT, starts at 0.05s; it is often the LCP text, so no longer delay).
  - `CountUp` - animates a number from 0 (first mount) or from the previous value (updates) to the new value in 0.6s with `animate()`/`useMotionValue`; renders tabular figures; exact final value; no animation under reduced motion.
  - `LiveCursor` - a `▍` that blinks (opacity 1/0, steps, 1.1s) next to "[~] cập nhật trực tiếp" labels; the only infinite loop allowed.
  - `StatusFlash` - wraps a status tag; when its `status` prop changes it plays a 0.35s border/background flash (opacity of an overlay 0.6 -> 0) - used for run/step/approval statuses.
  - `IconButton` helpers: `useIconHover()` returning `{ ref, handlers }` so a whole button/link hover/focus starts the itshover icon (`startAnimation` / `stopAnimation`).
- Hover: no lift, no shadow. Cards/rows: border color transitions to --hairline-strong in 0.2s. Buttons: background/border 0.2s; the icon inside animates.

## Icons (apps/web/src/icons, already copied - add `"use client";` at the top of each icon file in the setup job)
Size 16px inline / 18px nav, stroke 1.75 (pass `strokeWidth`), `currentColor`, `aria-hidden` (labels stay as text).
| Place | Icon |
|---|---|
| nav [0] Bảng điều khiển | layout-dashboard-icon |
| nav [1] Quy trình | stack-3-icon |
| nav [2] Lượt chạy | history-circle-icon |
| nav [3] Duyệt email | mail-filled-icon |
| nav [4] Builder | code-xml-icon |
| nav [5] AI Agents | brain-circuit-icon |
| nav [6] Cài đặt | gear-icon |
| Chạy | player-icon |
| Publish | upload-icon |
| Xóa | trash-icon |
| Duyệt và gửi | send-icon |
| Từ chối | x-icon |
| Tạo từ mẫu lead / Test agent | sparkles-icon |
| Đăng xuất | logout-icon |
| Xem run / Mở builder | eye-icon |
| task done checkbox | checked-icon (when ticked) |
| refresh/live labels | refresh-icon |
Keep the `[n]` index prefix in nav labels; the icon goes between the index and the label.

## Screens
### 1. App shell (components/app-shell.tsx, language-switcher.tsx, features/auth/auth-status.tsx)
- Nav: icons as above; the active item gets a 2px accent bar on the left that slides between items with `layoutId="nav-active"` (spring visualDuration 0.35, bounce 0). Hover starts the item's icon.
- Header: logout button with logout-icon; language switcher active chip uses `layoutId` slide.
- Page content enters with `Reveal` (opacity + y 8px, 0.35s) on route change.
- Responsive fix described in Layout.

### 2. Dashboard (app/dashboard/page.tsx, components/metric-card.tsx, features/leads/*)
- Page title `MaskHeading`.
- KPI row: `Stagger` of the 4 metric cards; numbers use `CountUp`.
- Leads table, sales tasks, recent runs, dependencies, providers, event stream: each panel `Reveal` once; table rows `Stagger` (first 8).
- Sales task tick: checkbox toggles with checked-icon draw animation; row text gets a strike-through that grows left to right (scaleX 0 -> 1, 0.25s) and the row moves to the done group with `layout` animation.
- Event stream: new events slide in from y -8px with `AnimatePresence` (items keyed by event id); header shows `[~] trực tiếp ▍` with `LiveCursor`.

### 3. Workflows list + runs list (app/workflows/page.tsx, features/workflows/*, app/runs/page.tsx, features/runs/runs-filter.tsx)
- Title `MaskHeading`; cards/rows `Stagger` on first mount.
- Buttons get icons (player, upload, trash, sparkles, eye). The delete confirm state swaps the label with a 0.2s cross-fade.
- The run status line under a card appears with `Reveal`.
- Runs pager: table body cross-fades (0.2s) on page/filter change.

### 4. Approvals + run detail (features/approvals/*, app/approvals/*, app/runs/[id]/page.tsx, features/runs/run-live.tsx, features/runs/step-timeline.tsx)
- Approval cards `Stagger`; on decision the card collapses (height via `layout` + opacity, 0.35s) and the outcome line appears in "Vừa xử lý" with `Reveal`.
- Edit toggle: inputs fade in (0.2s).
- Run timeline: steps `Stagger` on first load; when a step's status changes, `StatusFlash` on its tag; the "đang cập nhật trực tiếp" label uses `LiveCursor`.

### 5. Builder, agents, settings (features/workflow-builder/workflow-builder.tsx, app/agents/page.tsx, features/agents/ai-console.tsx, app/settings/page.tsx)
- Builder: node border color transitions 0.25s when its run status changes; run/publish buttons with icons; status line `Reveal`.
- Agents: provider list `Stagger`; "Test agent" button with sparkles-icon; result panel `Reveal` (the old result is cleared when a new run starts or fails).
- Settings: readiness rows `Stagger`; status tags `StatusFlash` on change.

## Quality budget
- Only transform/opacity animate (plus border-color/background-color micro transitions). No layout shift (CLS < 0.05), LCP unchanged (< 2.5s on the dashboard), no animation on every 5 s refetch.
- `prefers-reduced-motion`: no transforms, no loops except an opacity-only cursor that becomes static.
- Keyboard: focus starts the same icon animation as hover; focus rings unchanged (accent outline).
- Contrast AA unchanged; icons are decorative (`aria-hidden`).
