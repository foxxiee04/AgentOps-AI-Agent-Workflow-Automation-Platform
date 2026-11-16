"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { DURATION } from "./tokens";

export interface LiveCursorProps {
  /** Text rendered by the cursor; defaults to the terminal block. */
  char?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The only looping animation in the app: a `▍` block cursor that blinks in
 * hard steps next to "[~] cập nhật trực tiếp" labels.
 *
 * Reduced motion renders the same glyph, statically.
 */
export function LiveCursor({ char = "▍", className, style }: LiveCursorProps) {
  const reduce = useReducedMotion() ?? false;

  if (reduce) {
    return (
      <span aria-hidden="true" className={className} style={style}>
        {char}
      </span>
    );
  }

  return (
    <motion.span
      aria-hidden="true"
      className={className}
      style={style}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{
        duration: DURATION.cursorBlink,
        times: [0, 0.499, 0.5, 1],
        repeat: Infinity,
        ease: "linear"
      }}
    >
      {char}
    </motion.span>
  );
}
