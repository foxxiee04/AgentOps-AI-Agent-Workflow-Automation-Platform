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

const statusColor: Record<string, string> = {
  COMPLETED: "#10b981",
  WAITING_APPROVAL: "#f59e0b",
  RUNNING: "#5b4bff",
  PENDING: "#a3a6bd",
  CANCELLED: "#8b8fa8",
  FAILED: "#e5486f"
};

const categoryColor: Record<string, string> = {
  "high-intent": "linear-gradient(90deg,#5b4bff,#a855f7)",
  "low-intent": "linear-gradient(90deg,#38a8ff,#7cc8ff)",
  spam: "linear-gradient(90deg,#ff8aa8,#e5486f)"
};

const BUCKETS = 16;

/** Splits the time span covered by the runs into equal buckets so the chart needs no clock. */
function activityBuckets(runs: WorkflowRunView[]) {
  const times = runs.map((run) => Date.parse(run.createdAt)).filter((time) => Number.isFinite(time));
  const buckets = Array.from({ length: BUCKETS }, () => ({ total: 0, attention: 0 }));
  if (times.length === 0) {
    return buckets;
  }
  // Start at the 10th percentile so a few old runs do not squeeze everything into the last bar.
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
    <section className="lumen-card flex h-full min-w-0 flex-col p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-[var(--ink-deep)]">{title}</h2>
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

  // Donut geometry: one stroked circle per status, offset by the running total.
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
            {buckets.map((bucket, index) => (
              <div key={index} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className="relative w-full overflow-hidden rounded-md bg-gradient-to-t from-[#5b4bff] to-[#b79bff]"
                  style={{ height: `${Math.max(bucket.total > 0 ? 8 : 3, (bucket.total / peak) * 100)}%`, opacity: bucket.total > 0 ? 1 : 0.18 }}
                >
                  {bucket.attention > 0 ? (
                    <div
                      className="absolute inset-x-0 bottom-0 bg-[#ffb648]"
                      style={{ height: `${(bucket.attention / Math.max(1, bucket.total)) * 100}%` }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t.outcomes}>
        {totalRuns === 0 ? (
          <p className="py-8 text-sm text-[var(--mute)]">{t.empty}</p>
        ) : (
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={t.outcomes}>
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#eeeef6" strokeWidth="11" />
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
                    stroke={statusColor[status] ?? "#a3a6bd"}
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
                className="fill-[var(--ink-deep)] text-[20px] font-extrabold"
              >
                {totalRuns}
              </text>
            </svg>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {statuses.map(([status, count]) => (
                <li key={status} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor[status] ?? "#a3a6bd" }} />
                    <span className="truncate text-xs font-semibold text-[var(--body)]">{status}</span>
                  </span>
                  <span className="font-bold tabular-nums text-[var(--ink-deep)]">{count}</span>
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
                    <span className="font-bold tabular-nums text-[var(--ink-deep)]">{count}</span> · {t.avgScore} {avg}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eeeef6]">
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
