import { Activity, AlertTriangle, Building2, Sparkles, Users, Workflow } from "lucide-react";
import { MetricCard } from "../../components/metric-card";
import { Reveal, Stagger, StaggerItem } from "../../components/motion";
import type { Locale } from "../../lib/i18n";
import { formatAdminDate, type AdminLabels } from "./admin-ui";
import { AdminReportCard } from "./report-card";
import { AdminOverviewCharts } from "./overview-charts";
import type { AdminOverview } from "./schemas";

export function AdminOverviewView({
  overview,
  labels,
  locale,
  days
}: {
  overview: AdminOverview;
  labels: AdminLabels;
  locale: Locale;
  days: number;
}) {
  const kpis = labels.overview.kpis;
  const totals = overview.totals;
  // One decimal so 99.6% is not shown as 100%.
  const successRate = (Math.floor(totals.successRate * 1000) / 10).toLocaleString(locale === "vi" ? "vi-VN" : "en-US");

  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--mute)]">
        {labels.overview.generatedAt} {formatAdminDate(overview.generatedAt, locale)}
      </p>

      <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StaggerItem>
          <MetricCard
            tone="iris"
            icon={<Users className="h-[18px] w-[18px]" aria-hidden="true" />}
            label={kpis.users}
            value={totals.users}
            detail={kpis.newUsers.replace("{n}", String(totals.newUsers))}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            tone="sky"
            icon={<Activity className="h-[18px] w-[18px]" aria-hidden="true" />}
            label={kpis.active7d}
            value={totals.activeUsers7d}
            detail={kpis.disabledDetail.replace("{n}", String(totals.disabledUsers))}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            tone="violet"
            icon={<Building2 className="h-[18px] w-[18px]" aria-hidden="true" />}
            label={kpis.workspaces}
            value={totals.workspaces}
            detail={kpis.workspaceDetail
              .replace("{workflows}", String(totals.workflows))
              .replace("{active}", String(totals.activeWorkflows))}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            tone="iris"
            icon={<Workflow className="h-[18px] w-[18px]" aria-hidden="true" />}
            label={kpis.runs}
            value={totals.runs}
            detail={`${kpis.successRate.replace("{rate}", String(successRate))} · ${kpis.runsDetail
              .replace("{completed}", String(totals.runsCompleted))
              .replace("{failed}", String(totals.runsFailed))}`}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            tone="violet"
            icon={<Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />}
            label={kpis.tokens}
            value={totals.aiTokens}
            detail={kpis.tokensDetail.replace("{calls}", String(totals.aiCalls))}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            tone="rose"
            icon={<AlertTriangle className="h-[18px] w-[18px]" aria-hidden="true" />}
            label={kpis.pendingApprovals}
            value={totals.approvalsPending}
            detail={kpis.pendingDetail}
          />
        </StaggerItem>
      </Stagger>

      <Reveal>
        <AdminOverviewCharts overview={overview} labels={labels} locale={locale} />
      </Reveal>

      <Reveal>
        <AdminReportCard days={days} labels={labels} locale={locale} />
      </Reveal>
    </div>
  );
}
