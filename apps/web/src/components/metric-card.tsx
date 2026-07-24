import type { ReactNode } from "react";

export function MetricCard({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--hairline)] bg-white p-4">
      <p className="text-xs font-semibold uppercase text-[var(--mute)]">{label}</p>
      <p className="mt-2 text-3xl font-bold leading-tight text-[var(--ink-deep)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--body)]">{detail}</p>
    </div>
  );
}
