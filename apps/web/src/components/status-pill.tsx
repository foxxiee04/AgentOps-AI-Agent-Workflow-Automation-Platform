import { clsx } from "clsx";
import type { ReactNode } from "react";

export type StatusPillTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusPillTone, string> = {
  neutral: "border-[var(--hairline)] bg-[var(--surface-soft)] text-[var(--body)]",
  success: "border-[#bfe9d6] bg-[var(--success-soft)] text-[#075e41]",
  warning: "border-[#f6dca8] bg-[var(--warning-soft)] text-[var(--warning-ink)]",
  danger: "border-[#f7c3cf] bg-[var(--danger-soft)] text-[var(--danger-ink)]",
  info: "border-[#d5d0ff] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
};

const dotClass: Record<StatusPillTone, string> = {
  neutral: "bg-[var(--ash)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[#5b4bff]"
};

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusPillTone }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneClass[tone]
      )}
    >
      <span aria-hidden="true" className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[tone])} />
      {children}
    </span>
  );
}
