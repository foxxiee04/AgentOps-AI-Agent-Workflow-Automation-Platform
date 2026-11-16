"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { CountUp } from "./motion";

export type MetricTone = "iris" | "sky" | "violet" | "rose";

const toneClass: Record<MetricTone, { chip: string; glow: string }> = {
  iris: { chip: "bg-[#eeecff] text-[#4133d6]", glow: "from-[#7c5cff]/20" },
  sky: { chip: "bg-[#e6f4ff] text-[#0b62b8]", glow: "from-[#38a8ff]/20" },
  violet: { chip: "bg-[#f6eaff] text-[#8a2fc9]", glow: "from-[#c06bff]/20" },
  rose: { chip: "bg-[#ffeaf1] text-[#c2244f]", glow: "from-[#ff6b9a]/20" }
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
  const t = toneClass[tone];
  return (
    <div className="lumen-card lumen-card-lift relative h-full overflow-hidden p-5">
      <div
        aria-hidden="true"
        className={clsx("pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl", t.glow)}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-[var(--mute)]">{label}</p>
        {icon ? <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", t.chip)}>{icon}</span> : null}
      </div>
      <p className="relative mt-3 text-[2.1rem] font-extrabold leading-none tracking-tight text-[var(--ink-deep)] tabular-nums">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      <p className="relative mt-2 text-sm text-[var(--body)]">{detail}</p>
    </div>
  );
}
