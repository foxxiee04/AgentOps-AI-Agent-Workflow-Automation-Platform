/**
 * Shared motion tokens (design/design-brief.md, "Motion system").
 *
 * Only transform and opacity are animated. Distances stay small because the
 * product reads as a terminal: state changes should be legible, not theatrical.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.64, 0, 0.78, 0] as const;

export const DURATION = {
  /** Hover / border-color micro transitions. */
  micro: 0.2,
  /** Standard entrance (page content, status flashes). */
  base: 0.35,
  /** Panel reveal. */
  reveal: 0.5,
  /** CountUp number tween. */
  count: 0.6,
  /** Delay between staggered items. */
  stagger: 0.05,
  /** Opacity-only fade used when the user prefers reduced motion. */
  reducedFade: 0.15,
  /** MaskHeading starts almost immediately (it is often the LCP text). */
  headingDelay: 0.05,
  /** LiveCursor blink cycle. */
  cursorBlink: 1.1
} as const;

/** Terminal-sized move distance for reveals. */
export const DISTANCE = 8;

/** Items past this index appear together with the last staggered item. */
export const MAX_STAGGERED = 8;

/** Delay of a staggered item, capped so long lists do not crawl. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), MAX_STAGGERED - 1) * DURATION.stagger;
}
