"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { MaskHeading, Stagger, StaggerItem } from "../../components/motion";

export function WorkflowsHeading({ children }: { children: ReactNode }) {
  return (
    <MaskHeading className="mt-1 font-display text-[34px] leading-[1.1] text-[var(--ink)]">{children}</MaskHeading>
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
