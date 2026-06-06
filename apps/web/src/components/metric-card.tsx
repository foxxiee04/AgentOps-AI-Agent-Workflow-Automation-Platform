import type { ReactNode } from "react";

export function MetricCard({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-lg border border-[#dbe5df] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-[#64706d]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#18201f]">{value}</p>
      <p className="mt-1 text-sm text-[#64706d]">{detail}</p>
    </div>
  );
}

