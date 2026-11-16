import { z } from "zod";
import { leadSummaryViewSchema, salesTaskViewSchema, type LeadSummaryView, type SalesTaskView } from "@agentops/shared";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { DataNotice, ErrorState } from "../../components/data-state";
import { Reveal, Stagger, StaggerItem } from "../../components/motion";
import { StatusPill } from "../../components/status-pill";
import {
  fallbackActivity,
  fallbackHealth,
  fallbackOverview,
  fallbackProviders,
  fallbackRuns,
  safeHealthGet,
  sortWorkflowRunsNewestFirst,
  type AiProviders,
  type DashboardOverview,
  type HealthReady,
  type RecentActivity,
  type WorkflowRunView
} from "../../lib/api";
import { safeApiGet } from "../../lib/server-api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";
import { LeadTable, SalesTaskList } from "../../features/leads/lead-panels";
import { DashboardHeader, EventStream, RecentRunsTable } from "../../features/leads/dashboard-panels";
import { DashboardCharts } from "../../features/leads/dashboard-charts";
import { Activity, AlertTriangle, Sparkles, Workflow } from "lucide-react";

type WorkflowRunViewItem = WorkflowRunView & { workflowName?: string };
type DashboardSalesTaskView = SalesTaskView & { status: string; overdue?: boolean };

const dashboardSalesTaskSchema = salesTaskViewSchema.extend({
  status: z.string(),
  overdue: z.boolean().optional()
});

export default async function DashboardPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const [overview, runs, health, providers, activity] = await Promise.all([
    safeApiGet<DashboardOverview>("/dashboard/overview", fallbackOverview),
    safeApiGet<WorkflowRunViewItem[]>("/dashboard/workflow-runs", fallbackRuns as WorkflowRunViewItem[]),
    safeHealthGet<HealthReady>("/health/ready", fallbackHealth),
    safeApiGet<AiProviders>("/ai/providers", fallbackProviders),
    safeApiGet<RecentActivity[]>("/dashboard/recent-activity", fallbackActivity)
  ]);
  const [leads, salesTasks] = await Promise.all([
    safeApiGet<LeadSummaryView[]>("/dashboard/leads", [], z.array(leadSummaryViewSchema)),
    safeApiGet<DashboardSalesTaskView[]>("/dashboard/sales-tasks", [], z.array(dashboardSalesTaskSchema))
  ]);

  const dependencyRows =
    health.source === "error"
      ? [["api", { status: "down" }] as const]
      : Object.entries(health.data.details ?? health.data.info ?? health.data.error ?? { api: { status: health.data.status } });
  const recentRuns = runs.source === "error" ? [] : sortWorkflowRunsNewestFirst(runs.data).slice(0, 8);
  const isFallback = [overview, runs, health, providers, activity].some((resource) => resource.source === "fallback");
  // Overview and runs are the core of this page; without them only the error state is shown.
  const failed = [overview, runs].find((resource) => resource.source === "error");
  const providerList = providers.source === "error" ? [] : providers.data.providers;
  const events = activity.source === "error" ? [] : activity.data;

  return (
    <AppShell active="dashboard" locale={locale}>
      <div className="space-y-6 p-5 lg:p-8">
        <DashboardHeader
          eyebrow={t.dashboard.eyebrow}
          title={t.dashboard.title}
          builderHref={`/workflows/wf_lead_qualification/builder?lang=${locale}`}
          builderLabel={t.common.openBuilder}
        />

        <DataNotice resource={{ source: isFallback ? "fallback" : "api" }} labels={t.states} />

        {failed ? (
          <ErrorState labels={t.states} detail={failed.error} />
        ) : (
        <>
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <MetricCard tone="iris" icon={<Workflow className="h-[18px] w-[18px]" aria-hidden="true" />} label={t.dashboard.metrics.active} value={overview.data.activeWorkflows} detail={`${overview.data.totalWorkflows} ${t.dashboard.metrics.total}`} />
          </StaggerItem>
          <StaggerItem>
            <MetricCard tone="sky" icon={<Activity className="h-[18px] w-[18px]" aria-hidden="true" />} label={t.dashboard.metrics.runs} value={overview.data.runsToday} detail={t.dashboard.metrics.runsDetail} />
          </StaggerItem>
          <StaggerItem>
            <MetricCard tone="violet" icon={<Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />} label={t.dashboard.metrics.tokens} value={overview.data.aiTokensUsed} detail={`${providers.data.defaultProvider} ${t.dashboard.metrics.provider}`} />
          </StaggerItem>
          <StaggerItem>
            <MetricCard tone="rose" icon={<AlertTriangle className="h-[18px] w-[18px]" aria-hidden="true" />} label={t.dashboard.metrics.failures} value={overview.data.failedRuns} detail={t.dashboard.metrics.failuresDetail} />
          </StaggerItem>
        </Stagger>

        <Reveal>
          <DashboardCharts
            runs={runs.source === "error" ? [] : runs.data}
            leads={leads.source === "error" ? [] : leads.data}
            locale={locale}
          />
        </Reveal>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <Reveal className="min-w-0">
            <LeadTable leads={leads.source === "error" ? [] : leads.data} labels={t.dashboard} locale={locale} />
          </Reveal>
          <Reveal className="min-w-0">
            <SalesTaskList tasks={salesTasks.source === "error" ? [] : salesTasks.data} labels={t.dashboard} locale={locale} />
          </Reveal>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Reveal className="min-w-0">
            <RecentRunsTable
              runs={recentRuns}
              title={t.dashboard.recentRuns}
              detailsLabel={t.common.details}
              emptyLabel={t.dashboard.noRuns}
              locale={locale}
            />
          </Reveal>

          <div className="min-w-0 space-y-6">
            <Reveal>
              <div className="rounded-xl border border-[var(--hairline)] bg-white transition-colors duration-200 hover:border-[var(--hairline-strong)]">
                <div className="border-b border-[var(--hairline)] px-4 py-3">
                  <h2 className="text-base font-bold text-[var(--ink-deep)]">{t.dashboard.dependencies}</h2>
                </div>
                <div className="divide-y divide-[var(--hairline)]">
                  {dependencyRows.map(([name, dependency]) => (
                    <div key={name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <span>{name}</span>
                      <StatusPill tone={dependency.status === "up" ? "success" : "danger"}>{dependency.status}</StatusPill>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-xl border border-[var(--hairline)] bg-white transition-colors duration-200 hover:border-[var(--hairline-strong)]">
                <div className="border-b border-[var(--hairline)] px-4 py-3">
                  <h2 className="text-base font-bold text-[var(--ink-deep)]">{t.dashboard.providers}</h2>
                </div>
                <div className="divide-y divide-[var(--hairline)]">
                  {providerList.map((provider) => (
                    <div key={provider.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">{provider.id}</span>
                        <StatusPill tone={provider.status === "ready" || provider.status === "configured" ? "success" : "warning"}>
                          {provider.status}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-[var(--mute)]">{provider.defaultModel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <Reveal>
          <EventStream
            events={events}
            title={t.dashboard.eventStream}
            emptyLabel={t.dashboard.noEvents}
            locale={locale}
          />
        </Reveal>
        </>
        )}
      </div>
    </AppShell>
  );
}
