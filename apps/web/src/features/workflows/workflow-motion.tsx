"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { MaskHeading, Stagger, StaggerItem } from "../../components/motion";

export function WorkflowsHeading({ children }: { children: ReactNode }) {
  return (
    <MaskHeading className="mt-1 text-3xl font-bold leading-tight text-[var(--ink-deep)]">{children}</MaskHeading>
  );
}

export function WorkflowStagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Stagger className={className}>
      {Children.toArray(children).map((child, index) => (
        <StaggerItem key={isValidElement(child) && child.key != null ? child.key : index}>{child}</StaggerItem>
      ))}
    </Stagger>
  );
}
