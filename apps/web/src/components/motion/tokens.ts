/**
 * Shared motion tokens (design/design-brief.md, "Motion system").
 *
 * Only transform and opacity are animated. Distances stay small because the
 * product reads as an atelier ledger: state changes should be legible, not theatrical.
 */

/** Entrance: masks, page content, cards. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Exits: dismissed panels, collapsing rows. */
export const EASE_IN = [0.64, 0, 0.78, 0] as const;
/** Moves: hover lifts, layout shifts. */
export const EASE_MOVE = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  /** Hover / border-color micro transitions. */
  micro: 0.25,
  /** App page enter and card stagger (fade-up 12px, 0.4s). */
  base: 0.4,
  /** Section / heading reveal (brief: 0.7–0.9s). */
  reveal: 0.8,
  /** CountUp number tween. */
  count: 0.7,
  /** Delay between staggered items (brief: 0.06–0.1s). */
  stagger: 0.08,
  /** Opacity-only fade used when the user prefers reduced motion. */
  reducedFade: 0.15,
  /** MaskHeading starts almost immediately (it is often the LCP text). */
  headingDelay: 0.05,
  /** LiveCursor blink cycle. */
  cursorBlink: 1.1
} as const;

/** Reveal move distance (brief: 20px). */
export const DISTANCE = 20;

/** Items past this index appear together with the last staggered item. */
export const MAX_STAGGERED = 8;

/** Delay of a staggered item, capped so long lists do not crawl. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), MAX_STAGGERED - 1) * DURATION.stagger;
}
