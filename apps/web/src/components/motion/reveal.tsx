"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";
import { DISTANCE, DURATION, EASE_OUT, staggerDelay } from "./tokens";

const StaggerIndexContext = createContext(0);

type RevealMotionProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "variants">;

export interface RevealProps extends RevealMotionProps {
  /** Extra delay in seconds (kept short; the app reveal is 0.4s). */
  delay?: number;
}

/**
 * Fade + 20px rise on first mount. Runs once per mount, so background
 * refetches never replay it.
 */
export function Reveal({ children, delay = 0, transition, ...rest }: RevealProps) {
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      {...rest}
      initial={{ opacity: 0, y: reduce ? 0 : DISTANCE }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? DURATION.reducedFade : DURATION.base,
        ease: EASE_OUT,
        delay: reduce ? 0 : delay,
        ...transition
      }}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Supplies each `StaggerItem` with its index so delays can be capped.
 * Children keep their DOM position (the context provider adds no markup).
 */
export function Stagger({ children, className }: StaggerProps) {
  let index = 0;

  return (
    <div className={className}>
      {Children.map(children, (child) => {
        const current = index;
        index += 1;

        if (!isValidElement(child)) {
          return child;
        }

        return <StaggerIndexContext.Provider value={current}>{child}</StaggerIndexContext.Provider>;
      })}
    </div>
  );
}

export interface StaggerItemProps extends RevealMotionProps {
  /** Extra delay in seconds added to the staggered delay. */
  delay?: number;
}

/**
 * One staggered child. The first 8 items get `index * 0.08s`; the rest share
 * the last item's delay instead of trailing further behind.
 */
export function StaggerItem({ children, delay = 0, transition, ...rest }: StaggerItemProps) {
  const index = useContext(StaggerIndexContext);
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      {...rest}
      initial={{ opacity: 0, y: reduce ? 0 : DISTANCE }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? DURATION.reducedFade : DURATION.base,
        ease: EASE_OUT,
        delay: reduce ? 0 : staggerDelay(index) + delay,
        ...transition
      }}
    >
      {children}
    </motion.div>
  );
}
