import { clsx } from "clsx";
import type { ReactNode } from "react";

export type StatusBadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusBadgeTone, string> = {
  neutral: "bg-[#fdfcfc] text-[#201d1d] ring-[#646262]",
  success: "bg-[#f8f7f7] text-[#201d1d] ring-[#30d158]",
  warning: "bg-[#f8f7f7] text-[#201d1d] ring-[#ff9f0a]",
  danger: "bg-[#f8f7f7] text-[#201d1d] ring-[#ff3b30]",
  info: "bg-[#f8f7f7] text-[#201d1d] ring-[#007aff]"
};

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusBadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center rounded-[4px] px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone]
      )}
    >
      {children}
    </span>
  );
}
