"use client";

import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DURATION, EASE_OUT } from "./tokens";

export interface CountUpProps {
  /** Target value. */
  value: number;
  /** Tween length in seconds. */
  duration?: number;
  /** Formats the in-between value; defaults to a rounded integer. */
  format?: (value: number) => string;
  className?: string;
  style?: CSSProperties;
  /** Accessible label for the number, if the raw value is not self-explanatory. */
  "aria-label"?: string;
}

/**
 * Animates 0 -> value on first mount and previous -> value on updates.
 * The server-rendered markup already contains the final value, so the number
 * is correct without JavaScript and does not shift when hydration finishes.
 */
export function CountUp({ value, duration = DURATION.count, format, className, style, ...rest }: CountUpProps) {
  const reduce = useReducedMotion() ?? false;
  const [display, setDisplay] = useState(value);
  const motionValue = useMotionValue(value);
  const first = useRef(true);

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplay(latest);
  });

  useEffect(() => {
    const from = first.current ? 0 : motionValue.get();
    first.current = false;

    if (reduce) {
      motionValue.set(value);
      setDisplay(value);
      return;
    }

    motionValue.set(from);
    const controls = animate(motionValue, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [duration, motionValue, reduce, value]);

  const settled = reduce || display === value;
  const shown = settled ? value : display;
  const text = format ? format(shown) : String(Math.round(shown));

  return (
    <span {...rest} className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {text}
    </span>
  );
}
