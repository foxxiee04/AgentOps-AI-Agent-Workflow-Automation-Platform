import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { StatusPill, type StatusPillTone } from "../../components/status-pill";
import { fallbackRuns, safeApiGet, sortWorkflowRunsNewestFirst, type WorkflowRunView } from "../../lib/api";
import { appCopy, resolveLocale, type Locale, type LocaleSearchParams } from "../../lib/i18n";

const runStatusTone: Record<WorkflowRunView["status"], StatusPillTone> = {
  PENDING: "warning",
  RUNNING: "info",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral"
};

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function RunsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const runs = await safeApiGet<WorkflowRunView[]>("/dashboard/workflow-runs", fallbackRuns);
  const sortedRuns = sortWorkflowRunsNewestFirst(runs.data);

  return (
    <AppShell active="runs" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d8d0c7] pb-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#6b625a]">{t.runs.eyebrow}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-[#171412]">{t.runs.title}</h1>
          </div>
          <Link href={`/workflows/wf_lead_qualification/builder?lang=${locale}`} className="rounded-[4px] bg-[#1d1a18] px-4 py-2 text-sm font-semibold text-[#ffffff]">
            {t.runs.openBuilder}
          </Link>
        </div>

        {runs.source === "fallback" ? (
          <div className="rounded-[4px] border border-[#b45309] bg-[#fff7ed] px-3 py-2 text-sm text-[#7c2d12]">
            [!] {t.runs.fallback}
          </div>
        ) : null}

        <section className="border border-[#ded7cf] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-[#6b625a]">
                <tr className="border-b border-[#ded7cf]">
                  <th className="px-3 py-3 font-medium">Run</th>
                  <th className="px-3 py-3 font-medium">{t.runs.workflow}</th>
                  <th className="px-3 py-3 font-medium">{t.runs.status}</th>
                  <th className="px-3 py-3 font-medium">{t.runs.trigger}</th>
                  <th className="px-3 py-3 font-medium">{t.runs.createdAt}</th>
                  <th className="px-3 py-3 font-medium">{t.common.details}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.length > 0 ? (
                  sortedRuns.map((run) => (
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
                      <td className="px-3 py-3">{formatDateTime(run.createdAt, locale)}</td>
                      <td className="px-3 py-3">
                        <Link href={`/runs/${run.id}?lang=${locale}`} className="font-semibold text-[#1c1917] underline decoration-[#8f8379] underline-offset-4">
                          {t.common.details}
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-[#5f5750]">
                      [ ] {t.runs.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
