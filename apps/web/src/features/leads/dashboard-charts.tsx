import type { LeadSummaryView } from "@agentops/shared";
import type { WorkflowRunView } from "../../lib/api";
import type { Locale } from "../../lib/i18n";

const copy: Record<
  Locale,
  {
    activity: string;
    activityHint: string;
    outcomes: string;
    runs: string;
    quality: string;
    avgScore: string;
    leads: string;
    empty: string;
    categories: Record<string, string>;
  }
> = {
  en: {
    activity: "Run activity",
    activityHint: "Latest runs, oldest to newest",
    outcomes: "Run outcomes",
    runs: "runs",
    quality: "Lead quality",
    avgScore: "avg score",
    leads: "leads",
    empty: "No data yet",
    categories: { "high-intent": "High intent", "low-intent": "Low intent", spam: "Spam" }
  },
  vi: {
    activity: "Hoạt động chạy",
    activityHint: "Các lượt chạy gần nhất, cũ đến mới",
    outcomes: "Kết quả lượt chạy",
    runs: "lượt chạy",
    quality: "Chất lượng lead",
    avgScore: "điểm TB",
    leads: "lead",
    empty: "Chưa có dữ liệu",
    categories: { "high-intent": "Tiềm năng cao", "low-intent": "Tiềm năng thấp", spam: "Spam" }
  }
};

const series1 = "#2F5D3A";
const series2 = "#7FA37F";
const series3 = "#C9D6C6";

const statusColor: Record<string, string> = {
  COMPLETED: "var(--success)",
  WAITING_APPROVAL: "var(--warning)",
  RUNNING: "var(--live)",
  PENDING: "var(--ash)",
  CANCELLED: "var(--mute)",
  FAILED: "var(--danger)"
};

const categoryColor: Record<string, string> = {
  "high-intent": series1,
  "low-intent": series2,
  spam: series3
};

const BUCKETS = 16;

function activityBuckets(runs: WorkflowRunView[]) {
  const times = runs.map((run) => Date.parse(run.createdAt)).filter((time) => Number.isFinite(time));
  const buckets = Array.from({ length: BUCKETS }, () => ({ total: 0, attention: 0 }));
  if (times.length === 0) {
    return buckets;
  }
  const sorted = [...times].sort((left, right) => left - right);
  const min = sorted[Math.floor(sorted.length * 0.1)] ?? sorted[0] ?? 0;
  const span = Math.max((sorted[sorted.length - 1] ?? min) - min, 1);
  for (const run of runs) {
    const time = Date.parse(run.createdAt);
    if (!Number.isFinite(time)) {
      continue;
    }
    const bucket = buckets[Math.max(0, Math.min(BUCKETS - 1, Math.floor(((time - min) / span) * BUCKETS)))];
    if (bucket) {
      bucket.total += 1;
      if (run.status === "FAILED" || run.status === "CANCELLED" || run.status === "WAITING_APPROVAL") {
        bucket.attention += 1;
      }
    }
  }
  return buckets;
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card flex h-full min-w-0 flex-col p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
        {hint ? <p className="truncate text-xs text-[var(--mute)]">{hint}</p> : null}
      </div>
      <div className="mt-4 flex flex-1 flex-col justify-end">{children}</div>
    </section>
  );
}

export function DashboardCharts({ runs, leads, locale }: { runs: WorkflowRunView[]; leads: LeadSummaryView[]; locale: Locale }) {
  const t = copy[locale];
  const buckets = activityBuckets(runs);
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.total));

  const statusCounts = new Map<string, number>();
  for (const run of runs) {
    statusCounts.set(run.status, (statusCounts.get(run.status) ?? 0) + 1);
  }
  const statuses = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalRuns = runs.length;

  const categories = ["high-intent", "low-intent", "spam"].map((category) => {
    const items = leads.filter((lead) => lead.category === category);
    const avg = items.length > 0 ? Math.round(items.reduce((sum, lead) => sum + lead.leadScore, 0) / items.length) : 0;
    return { category, count: items.length, avg };
  });
  const totalLeads = Math.max(1, leads.length);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title={t.activity} hint={t.activityHint}>
        {totalRuns === 0 ? (
          <p className="py-8 text-sm text-[var(--mute)]">{t.empty}</p>
        ) : (
          <div className="flex h-36 items-end gap-1.5" role="img" aria-label={`${t.activity}: ${totalRuns} ${t.runs}`}>
            {buckets.map((bucket, index) => {
              const isLast = index === buckets.length - 1;
              return (
                <div key={index} className="flex h-full flex-1 flex-col justify-end">
                  <div
                    className="relative w-full overflow-hidden rounded-md"
                    style={{
                      height: `${Math.max(bucket.total > 0 ? 8 : 3, (bucket.total / peak) * 100)}%`,
                      opacity: bucket.total > 0 ? 1 : 0.18,
                      background: isLast && bucket.total > 0 ? "var(--live)" : series2
                    }}
                  >
                    {bucket.attention > 0 ? (
                      <div
                        className="absolute inset-x-0 bottom-0"
                        style={{
                          height: `${(bucket.attention / Math.max(1, bucket.total)) * 100}%`,
                          background: series1
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={t.outcomes}>
        {totalRuns === 0 ? (
          <p className="py-8 text-sm text-[var(--mute)]">{t.empty}</p>
        ) : (
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={t.outcomes}>
              <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-soft)" strokeWidth="11" />
              {statuses.map(([status, count]) => {
                const length = (count / totalRuns) * circumference;
                const dash = `${Math.max(length - 1.5, 0.5)} ${circumference}`;
                const segment = (
                  <circle
                    key={status}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={statusColor[status] ?? "var(--ash)"}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={dash}
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
                {totalRuns}
              </text>
            </svg>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {statuses.map(([status, count]) => (
                <li key={status} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor[status] ?? "var(--ash)" }} />
                    <span className="mono-label truncate text-[var(--body)]">{status}</span>
                  </span>
                  <span className="font-bold tabular-nums text-[var(--ink)]">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={t.quality} hint={`${leads.length} ${t.leads}`}>
        {leads.length === 0 ? (
          <p className="py-8 text-sm text-[var(--mute)]">{t.empty}</p>
        ) : (
          <ul className="space-y-4">
            {categories.map(({ category, count, avg }) => (
              <li key={category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-[var(--ink)]">{t.categories[category] ?? category}</span>
                  <span className="text-xs text-[var(--mute)]">
                    <span className="font-bold tabular-nums text-[var(--ink)]">{count}</span> · {t.avgScore} {avg}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                  <div className="h-full rounded-full" style={{ width: `${(count / totalLeads) * 100}%`, background: categoryColor[category] }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
