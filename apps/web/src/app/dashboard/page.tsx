import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { StatusPill, type StatusPillTone } from "../../components/status-pill";
import {
  fallbackActivity,
  fallbackHealth,
  fallbackOverview,
  fallbackProviders,
  fallbackRuns,
  safeApiGet,
  sortWorkflowRunsNewestFirst,
  type AiProviders,
  type DashboardOverview,
  type HealthReady,
  type RecentActivity,
  type WorkflowRunView
} from "../../lib/api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

const runStatusTone: Record<WorkflowRunView["status"], StatusPillTone> = {
  PENDING: "warning",
  RUNNING: "info",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral"
};

export default async function DashboardPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const [overview, runs, health, providers, activity] = await Promise.all([
    safeApiGet<DashboardOverview>("/dashboard/overview", fallbackOverview),
    safeApiGet<WorkflowRunView[]>("/dashboard/workflow-runs", fallbackRuns),
    safeApiGet<HealthReady>("/health/ready", fallbackHealth),
    safeApiGet<AiProviders>("/ai/providers", fallbackProviders),
    safeApiGet<RecentActivity[]>("/dashboard/recent-activity", fallbackActivity)
  ]);

  const dependencyRows = Object.entries(health.data.details ?? health.data.info ?? health.data.error ?? {
    api: { status: health.data.status }
  });
  const recentRuns = sortWorkflowRunsNewestFirst(runs.data).slice(0, 8);
  const isFallback = [overview, runs, health, providers, activity].some((resource) => resource.source === "fallback");

  return (
    <AppShell active="dashboard" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d8d0c7] pb-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#6b625a]">{t.dashboard.eyebrow}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-[#171412]">{t.dashboard.title}</h1>
          </div>
          <Link href={`/workflows/wf_lead_qualification/builder?lang=${locale}`} className="rounded-[4px] bg-[#1d1a18] px-4 py-2 text-sm font-semibold text-[#ffffff]">
            {t.common.openBuilder}
          </Link>
        </div>

        {isFallback ? (
          <div className="rounded-[4px] border border-[#b45309] bg-[#fff7ed] px-3 py-2 text-sm text-[#7c2d12]">
            [!] {t.common.fallback}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t.dashboard.metrics.active} value={overview.data.activeWorkflows} detail={`${overview.data.totalWorkflows} ${t.dashboard.metrics.total}`} />
          <MetricCard label={t.dashboard.metrics.runs} value={overview.data.runsToday} detail={t.dashboard.metrics.runsDetail} />
          <MetricCard label={t.dashboard.metrics.tokens} value={overview.data.aiTokensUsed} detail={`${providers.data.defaultProvider} ${t.dashboard.metrics.provider}`} />
          <MetricCard label={t.dashboard.metrics.failures} value={overview.data.failedRuns} detail={t.dashboard.metrics.failuresDetail} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="border border-[#ded7cf] bg-white">
            <div className="border-b border-[#ded7cf] px-4 py-3">
              <h2 className="text-base font-bold text-[#171412]">[+] {t.dashboard.recentRuns}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-xs uppercase text-[#6b625a]">
                  <tr className="border-b border-[#ded7cf]">
                    <th className="px-3 py-3 font-medium">Run</th>
                    <th className="px-3 py-3 font-medium">Workflow</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Trigger</th>
                    <th className="px-3 py-3 font-medium">{t.common.details}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.length > 0 ? (
                    recentRuns.map((run) => (
                      <tr key={run.id} className="border-b border-[#eee7df] last:border-b-0">
                        <td className="px-3 py-3 font-medium">
                          <Link href={`/runs/${run.id}?lang=${locale}`} className="underline decoration-[#8f8379] underline-offset-4">
                            {run.id}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{run.workflowId}</td>
                        <td className="px-3 py-3">
                          <StatusPill tone={runStatusTone[run.status]}>{run.status}</StatusPill>
                        </td>
                        <td className="px-3 py-3">{run.triggerType}</td>
                        <td className="px-3 py-3">
                          <Link href={`/runs/${run.id}?lang=${locale}`} className="font-semibold text-[#1c1917] underline decoration-[#8f8379] underline-offset-4">
                            {t.common.details}
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-[#5f5750]">
                        [ ] {t.dashboard.noRuns}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-[#ded7cf] bg-white">
              <div className="border-b border-[#ded7cf] px-4 py-3">
                <h2 className="text-base font-bold text-[#171412]">[+] {t.dashboard.dependencies}</h2>
              </div>
              <div className="divide-y divide-[#eee7df]">
                {dependencyRows.map(([name, dependency]) => (
                  <div key={name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span>{name}</span>
                    <StatusPill tone={dependency.status === "up" ? "success" : "danger"}>{dependency.status}</StatusPill>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#ded7cf] bg-white">
              <div className="border-b border-[#ded7cf] px-4 py-3">
                <h2 className="text-base font-bold text-[#171412]">[+] {t.dashboard.providers}</h2>
              </div>
              <div className="divide-y divide-[#eee7df]">
                {providers.data.providers.map((provider) => (
                  <div key={provider.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{provider.id}</span>
                      <StatusPill tone={provider.status === "ready" || provider.status === "configured" ? "success" : "warning"}>
                        {provider.status}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-[#5f5750]">{provider.defaultModel}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border border-[#ded7cf] bg-white">
          <div className="border-b border-[#ded7cf] px-4 py-3">
            <h2 className="text-base font-bold text-[#171412]">[+] {t.dashboard.eventStream}</h2>
          </div>
          <div className="divide-y divide-[#eee7df]">
            {activity.data.length > 0 ? (
              activity.data.slice(0, 6).map((event) => (
                <div key={event.eventId} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto]">
                  <span>{event.type}</span>
                  <span className="font-mono text-[#5f5750]">{event.eventId}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-4 text-sm text-[#5f5750]">[ ] {t.dashboard.noEvents}</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
