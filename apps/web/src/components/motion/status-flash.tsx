"use client";

import { clsx } from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DURATION, EASE_OUT } from "./tokens";

export interface StatusFlashProps {
  /** Any status string; a change from the previous render triggers the flash. */
  status: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a status tag and plays a 0.35s border/background flash when `status`
 * changes. The overlay fades 0.6 -> 0 and never intercepts pointer events.
 */
export function StatusFlash({ status, children, className }: StatusFlashProps) {
  const reduce = useReducedMotion() ?? false;
  const [flashId, setFlashId] = useState(0);
  const [visible, setVisible] = useState(false);
  const previous = useRef(status);

  useEffect(() => {
    if (previous.current === status) {
      return;
    }

    previous.current = status;
    setFlashId((id) => id + 1);
    setVisible(true);
  }, [status]);

  return (
    <span className={clsx("relative inline-flex", className)}>
      {children}
      {visible ? (
        <motion.span
          key={flashId}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl border border-current bg-current"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{
            duration: reduce ? DURATION.reducedFade : DURATION.base,
            ease: EASE_OUT
          }}
          onAnimationComplete={() => setVisible(false)}
        />
      ) : null}
    </span>
  );
}
