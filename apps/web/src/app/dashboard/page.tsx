import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";

export default function DashboardPage() {
  return (
    <AppShell active="Dashboard">
      <div className="space-y-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-[#0f8a66]">Overview</p>
            <h1 className="mt-1 text-3xl font-black">Workflow operations</h1>
          </div>
          <Link href="/workflows/wf_lead_qualification/builder" className="rounded-md bg-[#0f9f75] px-4 py-2 text-sm font-black text-white">
            Open builder
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active workflows" value="1" detail="Lead qualification ready" />
          <MetricCard label="Runs today" value="0" detail="Run after API starts" />
          <MetricCard label="AI tokens" value="0" detail="Mock provider enabled" />
          <MetricCard label="Failures" value="0" detail="No dead-letter events" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[#dbe5df] bg-white p-4">
            <h2 className="text-lg font-black">Recent workflow runs</h2>
            <div className="mt-4 overflow-hidden rounded-md border border-[#dbe5df]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#f7faf7] text-xs uppercase text-[#64706d]">
                  <tr>
                    <th className="px-3 py-3">Run</th>
                    <th className="px-3 py-3">Workflow</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#dbe5df]">
                    <td className="px-3 py-3 font-bold">run_demo</td>
                    <td className="px-3 py-3">Lead qualification</td>
                    <td className="px-3 py-3 text-[#0f8a66]">Ready</td>
                    <td className="px-3 py-3">Manual</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-[#dbe5df] bg-white p-4">
            <h2 className="text-lg font-black">Execution health</h2>
            <div className="mt-4 space-y-3">
              {["API health endpoints", "Workflow worker", "AI worker", "Tool worker"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md bg-[#f7faf7] p-3">
                  <span className="text-sm font-bold">{item}</span>
                  <span className="rounded-md bg-[#e5f6ef] px-2 py-1 text-xs font-black text-[#08785a]">planned</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

