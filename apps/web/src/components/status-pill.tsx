import { clsx } from "clsx";
import type { ReactNode } from "react";

export type StatusPillTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusPillTone, string> = {
  neutral: "is-neutral",
  success: "is-success",
  warning: "is-warning",
  danger: "is-danger",
  info: "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
};

const dotClass: Record<StatusPillTone, string> = {
  neutral: "bg-[var(--ash)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--accent)]"
};

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusPillTone }) {
  return (
    <span className={clsx("status-pill min-h-6", toneClass[tone])}>
      <span aria-hidden="true" className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[tone])} />
      {children}
    </span>
  );
}
