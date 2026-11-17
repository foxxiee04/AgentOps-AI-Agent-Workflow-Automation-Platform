"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { CountUp } from "./motion";

export type MetricTone = "iris" | "sky" | "violet" | "rose";

const toneClass: Record<MetricTone, string> = {
  iris: "bg-[var(--accent-soft)] text-[var(--accent)]",
  sky: "bg-[var(--success-soft)] text-[var(--success-ink)]",
  violet: "bg-[var(--surface-soft)] text-[var(--body)]",
  rose: "bg-[var(--danger-soft)] text-[var(--danger-ink)]"
};

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "iris"
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon?: ReactNode;
  tone?: MetricTone;
}) {
  const isNumeric = typeof value === "number";

  return (
    <div className="card lumen-card-lift h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="mono-label">{label}</p>
        {icon ? (
          <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)]", toneClass[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={clsx(
          "font-display mt-3 leading-none tabular-nums text-[var(--ink-deep)]",
          isNumeric ? "text-[2.5rem]" : "break-words text-[1.75rem]"
        )}
      >
        {isNumeric ? <CountUp value={value} /> : value}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-[var(--mute)]">{detail}</p>
    </div>
  );
}
