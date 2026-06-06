import { clsx } from "clsx";
import type { ReactNode } from "react";

export type StatusBadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusBadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200"
};

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusBadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone]
      )}
    >
      {children}
    </span>
  );
}

