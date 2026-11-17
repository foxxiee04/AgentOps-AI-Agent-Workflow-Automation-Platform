"use client";

import type { ReactNode } from "react";
import { MaskHeading } from "../../components/motion";

/** Page title for the approvals screen; keeps the mask reveal inside the client boundary. */
export function ApprovalsHeading({ children }: { children: ReactNode }) {
  return (
    <MaskHeading className="mt-1 font-display text-[34px] font-medium leading-tight text-[var(--ink)]">{children}</MaskHeading>
  );
}
