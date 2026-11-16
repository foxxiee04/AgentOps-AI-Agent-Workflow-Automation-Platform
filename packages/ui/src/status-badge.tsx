import { clsx } from "clsx";
import type { ReactNode } from "react";

export type StatusBadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<StatusBadgeTone, string> = {
  neutral: "bg-[#f2f2f9] text-[#474962] ring-[#d9d9ea]",
  success: "bg-[#e7f8f0] text-[#075e41] ring-[#bfe9d6]",
  warning: "bg-[#fff6e6] text-[#7a4504] ring-[#f6dca8]",
  danger: "bg-[#ffeef2] text-[#8c1337] ring-[#f7c3cf]",
  info: "bg-[#eeecff] text-[#4133d6] ring-[#d5d0ff]"
};

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusBadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        toneClass[tone]
      )}
    >
      {children}
    </span>
  );
}
