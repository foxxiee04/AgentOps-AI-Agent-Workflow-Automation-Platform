"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide motion configuration.
 *
 * `reducedMotion="user"` drops every transform animation when the operating
 * system asks for reduced motion; opacity fades are kept short by the
 * primitives themselves.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
