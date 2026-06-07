import type { ReactNode } from "react";

export function MetricCard({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="border border-[#ded7cf] bg-white p-4">
      <p className="text-xs font-semibold uppercase text-[#6b625a]">{label}</p>
      <p className="mt-2 text-3xl font-bold leading-tight text-[#171412]">{value}</p>
      <p className="mt-1 text-sm text-[#4e4742]">{detail}</p>
    </div>
  );
}
