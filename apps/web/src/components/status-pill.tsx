import { clsx } from "clsx";
import type { ReactNode } from "react";

export type StatusPillTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusPillTone, string> = {
  neutral: "border-[#8f8379] bg-white text-[#1c1917]",
  success: "border-[#15803d] bg-[#ecfdf3] text-[#14532d]",
  warning: "border-[#b45309] bg-[#fff7ed] text-[#7c2d12]",
  danger: "border-[#dc2626] bg-[#fff1f2] text-[#7f1d1d]",
  info: "border-[#2563eb] bg-[#eff6ff] text-[#1e3a8a]"
};

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusPillTone }) {
  return (
    <span className={clsx("inline-flex min-h-7 items-center rounded-[4px] border px-2 text-xs font-medium", toneClass[tone])}>
      {children}
    </span>
  );
}
