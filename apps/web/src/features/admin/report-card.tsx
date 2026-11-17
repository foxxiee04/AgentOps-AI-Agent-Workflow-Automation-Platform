import type { Locale } from "../../lib/i18n";
import { adminReportHref, type AdminReportType } from "./api";
import type { AdminLabels } from "./admin-ui";

const reportTypes: Array<{ type: AdminReportType; key: "exportUsers" | "exportWorkspaces" | "exportRuns" | "exportUsage" }> = [
  { type: "users", key: "exportUsers" },
  { type: "workspaces", key: "exportWorkspaces" },
  { type: "runs", key: "exportRuns" },
  { type: "usage", key: "exportUsage" }
];

export function AdminReportCard({
  days,
  labels,
  locale
}: {
  days: number;
  labels: AdminLabels;
  locale: Locale;
}) {
  return (
    <section className="card flex h-full flex-col p-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--ink)]">{labels.overview.exportTitle}</h3>
        <p className="mt-1 text-sm text-[var(--mute)]">{labels.overview.exportBody}</p>
      </div>
      <div className="mt-4 grid flex-1 grid-cols-2 gap-2 self-stretch">
        {reportTypes.map((report) => (
          <a
            key={report.type}
            href={adminReportHref(report.type, days)}
            download
            className="btn btn-secondary min-h-9 px-3 text-[13px]"
            data-report={report.type}
          >
            {labels.overview[report.key]}
          </a>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ash)]">
        {labels.range.label}: {labels.range[`d${days as 7 | 30 | 90}`] ?? `${days}`} · {locale.toUpperCase()}
      </p>
    </section>
  );
}

