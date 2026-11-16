"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useRef, type RefObject } from "react";
import type { AnimatedIconHandle } from "../../icons/types";

export interface IconHoverHandlers {
  /** Attach to the animated icon (`<PlayerIcon ref={ref} />`). */
  ref: RefObject<AnimatedIconHandle | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Focus starts the icon so keyboard users get the same cue as hover. */
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * Starts / stops an itshover icon from a whole button or link:
 *
 * ```tsx
 * const icon = useIconHover();
 * <button {...icon} className="...">
 *   <PlayerIcon ref={icon.ref} size={16} aria-hidden="true" />
 *   Chạy
 * </button>
 * ```
 */
export function useIconHover(): IconHoverHandlers {
  const ref = useRef<AnimatedIconHandle | null>(null);
  // itshover icons animate imperatively (useAnimate), which MotionConfig cannot switch off.
  const reduceMotion = useReducedMotion();

  const start = useCallback(() => {
    if (!reduceMotion) ref.current?.startAnimation();
  }, [reduceMotion]);

  const stop = useCallback(() => {
    if (!reduceMotion) ref.current?.stopAnimation();
  }, [reduceMotion]);

  return {
    ref,
    onMouseEnter: start,
    onMouseLeave: stop,
    onFocus: start,
    onBlur: stop
  };
}
