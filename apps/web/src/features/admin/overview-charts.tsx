import type { ReactNode } from "react";
import type { Locale } from "../../lib/i18n";
import { formatAdminNumber, type AdminLabels } from "./admin-ui";
import type { AdminOverview } from "./schemas";

const series1 = "#2F5D3A";
const series2 = "#7FA37F";
const series3 = "#C9D6C6";
const live = "#C6F35C";

function dayLabel(date: string, locale: Locale) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card flex h-full min-w-0 flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
        {hint ? <p className="truncate text-xs text-[var(--mute)]">{hint}</p> : null}
      </div>
      <div className="mt-4 flex flex-1 flex-col justify-end">{children}</div>
    </section>
  );
}

function GridLines() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
      {[0, 1, 2, 3].map((line) => (
        <div key={line} className="border-t border-[var(--hairline)]" />
      ))}
    </div>
  );
}

function DayAxis({ series, locale }: { series: AdminOverview["series"]; locale: Locale }) {
  if (series.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">
      <span>{dayLabel(series[0].date, locale)}</span>
      <span>{dayLabel(series[series.length - 1].date, locale)}</span>
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return <p className="py-10 text-sm text-[var(--mute)]">{label}</p>;
}

function BarSeries({
  values,
  failed,
  format,
  title
}: {
  values: number[];
  failed?: number[];
  format: (value: number) => string;
  title: string;
}) {
  const peak = Math.max(1, ...values);
  const last = values.length - 1;

  return (
    <div className="relative h-40" role="img" aria-label={title}>
      <GridLines />
      <div className="relative flex h-full items-end gap-[3px]">
        {values.map((value, index) => {
          const failedValue = failed?.[index] ?? 0;
          const height = value > 0 ? Math.max(4, (value / peak) * 100) : 2;
          return (
            <div key={index} className="flex h-full flex-1 flex-col justify-end" title={`${format(value)}`}>
              <div
                className="relative w-full overflow-hidden rounded-t-[3px] transition-colors"
                style={{
                  height: `${height}%`,
                  opacity: value > 0 ? 1 : 0.18,
                  background: index === last && value > 0 ? live : series2
                }}
              >
                {failedValue > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0"
                    style={{
                      height: `${(failedValue / Math.max(1, value)) * 100}%`,
                      background: "var(--danger)"
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProviderBars({
  data,
  labels,
  locale
}: {
  data: AdminOverview["signupsByProvider"];
  labels: AdminLabels["overview"]["charts"];
  locale: Locale;
}) {
  const counts = new Map(data.map((entry) => [entry.provider, entry.users]));
  const rows = [
    { key: "password" as const, label: labels.password, value: counts.get("password") ?? 0, color: series1 },
    { key: "google" as const, label: labels.google, value: counts.get("google") ?? 0, color: series2 }
  ];
  const peak = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-[var(--ink)]">{row.label}</span>
            <span className="font-mono text-xs tabular-nums text-[var(--mute)]">
              {formatAdminNumber(row.value, locale)}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(row.value / peak) * 100}%`, background: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminOverviewCharts({ overview, labels, locale }: { overview: AdminOverview; labels: AdminLabels; locale: Locale }) {
  const charts = labels.overview.charts;
  const series = overview.series;
  const hasSeries = series.length > 0;
  const totals = overview.totals;

  const outcomeTotal = totals.approvalsApproved + totals.approvalsRejected + totals.approvalsPending;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const outcomes = [
    { key: "approved", label: charts.approved, value: totals.approvalsApproved, color: series1 },
    { key: "rejected", label: charts.rejected, value: totals.approvalsRejected, color: "var(--danger)" },
    { key: "pending", label: charts.pending, value: totals.approvalsPending, color: "var(--warning)" }
  ];
  let offset = 0;

  const leadRows = [
    { key: "high", label: charts.high, value: totals.leadsHigh, color: series1 },
    { key: "low", label: charts.low, value: totals.leadsLow, color: series2 },
    { key: "spam", label: charts.spam, value: totals.leadsSpam, color: series3 }
  ];
  const leadPeak = Math.max(1, ...leadRows.map((row) => row.value));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={charts.runsTitle} hint={charts.runsHint}>
          {hasSeries ? (
            <>
              <BarSeries
                values={series.map((point) => point.runs)}
                failed={series.map((point) => point.runsFailed)}
                format={(value) => formatAdminNumber(value, locale)}
                title={charts.runsTitle}
              />
              <DayAxis series={series} locale={locale} />
            </>
          ) : (
            <NoData label={charts.noData} />
          )}
        </Card>

        <Card title={charts.signupsTitle} hint={charts.signupsHint}>
          {hasSeries ? (
            <>
              <BarSeries
                values={series.map((point) => point.signups)}
                format={(value) => formatAdminNumber(value, locale)}
                title={charts.signupsTitle}
              />
              <DayAxis series={series} locale={locale} />
            </>
          ) : (
            <NoData label={charts.noData} />
          )}
        </Card>

        <Card title={charts.tokensTitle} hint={charts.tokensHint}>
          {hasSeries ? (
            <>
              <BarSeries
                values={series.map((point) => point.aiTokens)}
                format={(value) => formatAdminNumber(value, locale)}
                title={charts.tokensTitle}
              />
              <DayAxis series={series} locale={locale} />
            </>
          ) : (
            <NoData label={charts.noData} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={charts.approvalsTitle} hint={charts.approvalsHint}>
          {outcomeTotal === 0 ? (
            <NoData label={charts.noData} />
          ) : (
            <div className="flex items-center gap-5">
              <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={charts.approvalsTitle}>
                <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-soft)" strokeWidth="11" />
                {outcomes.map((outcome) => {
                  const length = (outcome.value / outcomeTotal) * circumference;
                  const segment = (
                    <circle
                      key={outcome.key}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={outcome.color}
                      strokeWidth="11"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.max(length - 1.5, 0.5)} ${circumference}`}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += length;
                  return segment;
                })}
                <text
                  x="50"
                  y="50"
                  transform="rotate(90 50 50)"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-[var(--ink)] text-[20px] font-extrabold"
                  style={{ fontFamily: "var(--font-display-stack)" }}
                >
                  {outcomeTotal}
                </text>
              </svg>
              <ul className="min-w-0 flex-1 space-y-2 text-sm">
                {outcomes.map((outcome) => (
                  <li key={outcome.key} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: outcome.color }} />
                      <span className="mono-label truncate text-[var(--body)]">{outcome.label}</span>
                    </span>
                    <span className="font-bold tabular-nums text-[var(--ink)]">{outcome.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title={charts.leadsTitle} hint={charts.leadsHint}>
          <ul className="space-y-4">
            {leadRows.map((row) => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-[var(--ink)]">{row.label}</span>
                  <span className="font-mono text-xs tabular-nums text-[var(--mute)]">
                    {formatAdminNumber(row.value, locale)}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                  <div className="h-full rounded-full" style={{ width: `${(row.value / leadPeak) * 100}%`, background: row.color }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={charts.providerTitle} hint={charts.providerHint}>
          <ProviderBars data={overview.signupsByProvider} labels={charts} locale={locale} />
        </Card>
      </div>

      <Card title={charts.topTitle} hint={charts.topHint}>
        {overview.topWorkspaces.length === 0 ? (
          <NoData label={charts.noData} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--hairline)]">
                  <th className="px-2 py-2 font-medium">{charts.columns.name}</th>
                  <th className="px-2 py-2 text-right font-medium">{charts.columns.runs}</th>
                  <th className="px-2 py-2 text-right font-medium">{charts.columns.members}</th>
                  <th className="px-2 py-2 text-right font-medium">{charts.columns.tokens}</th>
                </tr>
              </thead>
              <tbody>
                {overview.topWorkspaces.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-[var(--hairline)] last:border-b-0">
                    <td className="px-2 py-2.5 font-medium text-[var(--ink)]">{workspace.name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatAdminNumber(workspace.runs, locale)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatAdminNumber(workspace.members, locale)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatAdminNumber(workspace.aiTokens, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
