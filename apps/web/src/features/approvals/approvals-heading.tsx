"use client";

import type { ReactNode } from "react";
import { MaskHeading } from "../../components/motion";

/** Page title for the approvals screen; keeps the mask reveal inside the client boundary. */
export function ApprovalsHeading({ children }: { children: ReactNode }) {
  return (
    <MaskHeading className="mt-1 text-3xl font-bold leading-tight text-[var(--ink)]">{children}</MaskHeading>
  );
}
