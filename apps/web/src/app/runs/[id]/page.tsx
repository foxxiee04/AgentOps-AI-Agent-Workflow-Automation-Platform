import Link from "next/link";
import { workflowRunStepsViewSchema, workflowRunViewSchema } from "@agentops/shared";
import { AppShell } from "../../../components/app-shell";
import { DataNotice, ErrorState } from "../../../components/data-state";
import { RunDetailHeading, RunHeaderLink, RunLive } from "../../../features/runs/run-live";
import { fallbackRunForId, fallbackStepsForRun } from "../../../lib/api";
import { safeApiGet } from "../../../lib/server-api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../../lib/i18n";
import { formatDateTime } from "../../../lib/status";

export default async function RunDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: LocaleSearchParams;
}) {
  const { id } = await params;
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const [run, steps] = await Promise.all([
    safeApiGet(`/workflow-runs/${encodeURIComponent(id)}`, fallbackRunForId(id), workflowRunViewSchema),
    safeApiGet(`/workflow-runs/${encodeURIComponent(id)}/steps`, fallbackStepsForRun(id), workflowRunStepsViewSchema)
  ]);
  const failed = run.source === "error" ? run : steps.source === "error" ? steps : undefined;
  const isFallback = run.source === "fallback" || steps.source === "fallback";

  return (
    <AppShell active="runs" locale={locale}>
      <div className="space-y-6 p-5 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-4">
          <div className="min-w-0">
            <p className="mono-label">{t.runs.eyebrow}</p>
            <RunDetailHeading>{t.runs.detailTitle}</RunDetailHeading>
            <p className="mt-1 break-all font-mono text-sm text-[var(--mute)]">{id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/runs?lang=${locale}`} className="btn btn-secondary inline-flex items-center">
              {t.runs.backToRuns}
            </Link>
            {failed ? null : (
              <RunHeaderLink primary href={`/workflows/${run.data.workflowId}/builder?lang=${locale}`}>
                {t.runs.openBuilder}
              </RunHeaderLink>
            )}
          </div>
        </div>

        {failed ? (
          <ErrorState labels={t.states} detail={failed.error} />
        ) : (
          <>
            <DataNotice resource={{ source: isFallback ? "fallback" : "api" }} labels={t.states} />
            <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="min-w-0">
                <RunLive
                  runId={id}
                  initialRun={run.data}
                  initialSteps={steps.data}
                  labels={{ ...t.timeline, steps: t.runs.steps }}
                  locale={locale}
                  poll={!isFallback}
                />
              </div>

              <aside className="min-w-0 space-y-6">
                 <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]">
                   <div className="border-b border-[var(--hairline)] px-4 py-3">
                     <h2 className="text-base font-semibold text-[var(--ink)]">{t.runs.workflow}</h2>
                   </div>
                  <dl className="divide-y divide-[var(--hairline)] text-sm">
                    <RunMetaRow label={t.runs.workflow} value={run.data.workflowId} />
                    <RunMetaRow label={t.runs.version} value={run.data.workflowVersionId} />
                    <RunMetaRow label={t.runs.trigger} value={run.data.triggerType} />
                    <RunMetaRow label={t.runs.createdAt} value={formatDateTime(run.data.createdAt, locale)} />
                    <RunMetaRow label={t.runs.event} value={run.data.eventId ?? "not-published"} />
                    <RunMetaRow label={t.runs.dataSource} value={isFallback ? "fallback" : "api"} />
                  </dl>
                </div>

                 <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]">
                   <div className="border-b border-[var(--hairline)] px-4 py-3">
                     <h2 className="text-base font-semibold text-[var(--ink)]">{t.timeline.input}</h2>
                   </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-5 text-[var(--charcoal)]">{JSON.stringify(run.data.input, null, 2)}</pre>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function RunMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3">
      <dt className="mono-label">{label}</dt>
      <dd className="break-all font-medium text-[var(--ink)]">{value}</dd>
    </div>
  );
}
