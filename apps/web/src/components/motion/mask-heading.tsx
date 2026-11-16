"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT } from "./tokens";

export type MaskHeadingTag = "h1" | "h2" | "h3";

export interface MaskHeadingProps {
  children: ReactNode;
  /** Heading level; page titles default to `h1`. */
  as?: MaskHeadingTag;
  className?: string;
  /** Delay in seconds before the rise starts. */
  delay?: number;
}

/**
 * Page title that rises out of an overflow-hidden mask (y 100% -> 0).
 * The mask is a plain span so the heading keeps its semantic level.
 */
export function MaskHeading({ children, as: Tag = "h1", className, delay = DURATION.headingDelay }: MaskHeadingProps) {
  const reduce = useReducedMotion() ?? false;

  return (
    <Tag className={className}>
      <span className="block overflow-hidden">
        <motion.span
          className="block"
          initial={{ y: reduce ? 0 : "100%" }}
          animate={{ y: 0 }}
          transition={{
            duration: reduce ? DURATION.reducedFade : DURATION.reveal,
            ease: EASE_OUT,
            delay: reduce ? 0 : delay
          }}
        >
          {children}
        </motion.span>
      </span>
    </Tag>
  );
}
