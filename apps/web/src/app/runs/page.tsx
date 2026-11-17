import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { DataNotice, EmptyState, ErrorState } from "../../components/data-state";
import { StatusPill } from "../../components/status-pill";
import { runStatusTone } from "../../lib/status";
import { fallbackRuns, sortWorkflowRunsNewestFirst, type WorkflowRunView } from "../../lib/api";
import { safeApiGet } from "../../lib/server-api";
import { appCopy, normalizeLocale, type Locale } from "../../lib/i18n";
import { getActiveWorkspace } from "../../lib/workspace";
import {
  OpenBuilderLink,
  RunsFilter,
  RunsPageHeading,
  RunsRow,
  RunsTableBody
} from "../../features/runs/runs-filter";

type WorkflowRunViewItem = WorkflowRunView & { workflowName?: string };

type RunsSearchParams = {
  lang?: string | string[];
  page?: string | string[];
  status?: string | string[];
};

const RUN_STATUSES = [
  "ALL",
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;

function normalizeStatus(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return RUN_STATUSES.includes((raw ?? "ALL") as (typeof RUN_STATUSES)[number]) ? (raw ?? "ALL") : "ALL";
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function RunsPage({
  searchParams
}: {
  searchParams?: Promise<RunsSearchParams | undefined>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const locale = normalizeLocale(resolved?.lang);
  const t = appCopy[locale];
  const { active } = await getActiveWorkspace();

  if (!active) {
    return (
      <AppShell active="runs" locale={locale}>
        <div className="space-y-8 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.runs.eyebrow}</p>
              <RunsPageHeading>{t.runs.title}</RunsPageHeading>
            </div>
          </div>
          <EmptyState title={t.states.emptyTitle} body={t.shell.noWorkspacesMessage} />
        </div>
      </AppShell>
    );
  }

  const requestedPage = Math.max(1, Number(readParam(resolved?.page)) || 1);
  const status = normalizeStatus(resolved?.status);

  const offset = (requestedPage - 1) * 50;

  const listParams = new URLSearchParams();
  listParams.set("workspaceId", active.id);
  listParams.set("limit", "50");
  listParams.set("offset", String(offset));
  if (status !== "ALL") listParams.set("status", status);

  const countParams = new URLSearchParams();
  countParams.set("workspaceId", active.id);
  if (status !== "ALL") countParams.set("status", status);

  const listPath = `/dashboard/workflow-runs?${listParams.toString()}`;
  const countPath = `/dashboard/workflow-runs/count?${countParams.toString()}`;

  const [runs, count] = await Promise.all([
    safeApiGet<WorkflowRunViewItem[]>(listPath, fallbackRuns as WorkflowRunViewItem[]),
    safeApiGet<{ total: number }>(countPath, { total: fallbackRuns.length })
  ]);

  const total = count.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const page = Math.min(requestedPage, totalPages);

  const sortedRuns = sortWorkflowRunsNewestFirst(runs.data);

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    params.set("lang", locale);
    if (status !== "ALL") params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `/runs?${params.toString()}`;
  }

  const emptyLabel = locale === "vi" ? "Không có run nào cho bộ lọc này" : "No runs for this filter";

  return (
    <AppShell active="runs" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.runs.eyebrow}</p>
            <RunsPageHeading>{t.runs.title}</RunsPageHeading>
          </div>
          <OpenBuilderLink href={`/workflows/wf_lead_qualification/builder?lang=${locale}`}>
            {t.runs.openBuilder}
          </OpenBuilderLink>
        </div>

        <DataNotice resource={runs} labels={t.states} />

        {runs.source === "error" ? (
          <ErrorState labels={t.states} detail={runs.error} />
        ) : (
        <section className="rounded-xl border border-[var(--hairline)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-3 py-3">
            <RunsFilter locale={locale} status={status} />
            <span className="text-xs text-[var(--mute)]">
              {page}/{totalPages}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-[var(--mute)]">
                <tr className="border-b border-[var(--hairline)]">
                  <th className="px-3 py-3 font-medium">Run</th>
                  <th className="px-3 py-3 font-medium">{t.runs.workflow}</th>
                  <th className="px-3 py-3 font-medium">{t.runs.status}</th>
                  <th className="px-3 py-3 font-medium">{t.runs.trigger}</th>
                  <th className="px-3 py-3 font-medium">{t.runs.createdAt}</th>
                  <th className="px-3 py-3 font-medium">{t.common.details}</th>
                </tr>
              </thead>
              <RunsTableBody transitionKey={`${page}-${status}`}>
                {sortedRuns.length > 0 ? (
                  sortedRuns.map((run, index) => (
                    <RunsRow key={run.id} index={index} className="border-b border-[var(--hairline)] last:border-b-0">
                      <td className="px-3 py-3 font-medium">
                        <Link href={`/runs/${run.id}?lang=${locale}`} className="underline decoration-[var(--hairline-strong)] underline-offset-4">
                          {run.id}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{run.workflowName || run.workflowId}</td>
                      <td className="px-3 py-3">
                        <StatusPill tone={runStatusTone[run.status]}>{run.status}</StatusPill>
                      </td>
                      <td className="px-3 py-3">{run.triggerType}</td>
                      <td className="px-3 py-3">{formatDateTime(run.createdAt, locale)}</td>
                      <td className="px-3 py-3">
                        <Link href={`/runs/${run.id}?lang=${locale}`} className="font-semibold text-[var(--ink-deep)] underline decoration-[var(--hairline-strong)] underline-offset-4">
                          {t.common.details}
                        </Link>
                      </td>
                    </RunsRow>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-[var(--mute)]">
                      {emptyLabel}
                    </td>
                  </tr>
                )}
              </RunsTableBody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[var(--hairline)] px-3 py-3 text-sm text-[var(--ink-deep)]">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="underline decoration-[var(--hairline-strong)] underline-offset-4">
                ‹ Trước
              </Link>
            ) : (
              <span className="text-[var(--ash)]" aria-disabled="true">
                ‹ Trước
              </span>
            )}
            <span>
              Trang {page}/{totalPages} · {total.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} run
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="underline decoration-[var(--hairline-strong)] underline-offset-4">
                Sau ›
              </Link>
            ) : (
              <span className="text-[var(--ash)]" aria-disabled="true">
                Sau ›
              </span>
            )}
          </div>
        </section>
        )}
      </div>
    </AppShell>
  );
}
