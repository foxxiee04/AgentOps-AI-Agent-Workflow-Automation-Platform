"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Page enter transition for every route. Opacity only: a transform on this wrapper would become the
 * containing block of fixed/sticky descendants (scroll progress bar, sticky header, mobile sheet).
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
