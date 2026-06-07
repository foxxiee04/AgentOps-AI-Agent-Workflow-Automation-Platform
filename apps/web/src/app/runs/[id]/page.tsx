import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { MetricCard } from "../../../components/metric-card";
import { StatusPill, type StatusPillTone } from "../../../components/status-pill";
import {
  fallbackRunForId,
  fallbackStepsForRun,
  safeApiGet,
  type WorkflowRunStepView,
  type WorkflowRunStepsView,
  type WorkflowRunView
} from "../../../lib/api";
import { appCopy, resolveLocale, type Locale, type LocaleSearchParams } from "../../../lib/i18n";

const runStatusTone: Record<WorkflowRunView["status"], StatusPillTone> = {
  PENDING: "warning",
  RUNNING: "info",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral"
};

const stepStatusTone: Record<WorkflowRunStepView["status"], StatusPillTone> = {
  PENDING: "warning",
  RUNNING: "info",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  SKIPPED: "neutral"
};

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

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
  const fallbackRun = fallbackRunForId(id);
  const [run, steps] = await Promise.all([
    safeApiGet<WorkflowRunView>(`/workflow-runs/${id}`, fallbackRun),
    safeApiGet<WorkflowRunStepsView>(`/workflow-runs/${id}/steps`, fallbackStepsForRun(id))
  ]);
  const isFallback = run.source === "fallback" || steps.source === "fallback";
  const completedSteps = steps.data.steps.filter((step) => step.status === "COMPLETED").length;
  const failedSteps = steps.data.steps.filter((step) => step.status === "FAILED").length;
  const pendingSteps = steps.data.steps.filter((step) => step.status === "PENDING" || step.status === "WAITING_APPROVAL").length;

  return (
    <AppShell active="runs" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d8d0c7] pb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-[#6b625a]">{t.runs.eyebrow}</p>
            <h1 className="mt-1 break-all text-3xl font-bold leading-tight text-[#171412]">{t.runs.detailTitle}</h1>
            <p className="mt-1 break-all font-mono text-sm text-[#5f5750]">{run.data.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/runs?lang=${locale}`} className="inline-flex min-h-9 items-center rounded-[4px] border border-[#8f8379] bg-white px-3 text-sm font-semibold text-[#1c1917]">
              {t.runs.backToRuns}
            </Link>
            <Link
              href={`/workflows/${run.data.workflowId}/builder?lang=${locale}`}
              className="inline-flex min-h-9 items-center rounded-[4px] bg-[#1d1a18] px-3 text-sm font-semibold text-[#ffffff]"
            >
              {t.runs.openBuilder}
            </Link>
          </div>
        </div>

        {isFallback ? (
          <div className="rounded-[4px] border border-[#b45309] bg-[#fff7ed] px-3 py-2 text-sm text-[#7c2d12]">
            [!] {t.runs.fallback}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label={t.runs.completed} value={completedSteps} detail={t.runs.steps} />
          <MetricCard label={t.runs.pending} value={pendingSteps} detail={run.data.status} />
          <MetricCard label={t.runs.failed} value={failedSteps} detail={run.data.workflowId} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="border border-[#ded7cf] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded7cf] px-4 py-3">
              <h2 className="text-base font-bold text-[#171412]">[+] {t.runs.steps}</h2>
              <StatusPill tone={runStatusTone[run.data.status]}>{run.data.status}</StatusPill>
            </div>
            <div className="divide-y divide-[#eee7df]">
              {steps.data.steps.map((step, index) => (
                <article key={step.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[56px_1fr_auto] md:items-start">
                  <span className="font-mono text-xs font-bold text-[#6b625a]">[{String(index + 1).padStart(2, "0")}]</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#171412]">{step.nodeName}</h3>
                      <span className="font-mono text-xs font-semibold text-[#5f5750]">{step.nodeType}</span>
                    </div>
                    <p className="mt-1 text-[#4e4742]">{step.message}</p>
                    <p className="mt-2 break-all font-mono text-xs text-[#6b625a]">{step.nodeId}</p>
                  </div>
                  <StatusPill tone={stepStatusTone[step.status]}>{step.status}</StatusPill>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="border border-[#ded7cf] bg-white">
              <div className="border-b border-[#ded7cf] px-4 py-3">
                <h2 className="text-base font-bold text-[#171412]">[+] {t.runs.workflow}</h2>
              </div>
              <div className="divide-y divide-[#eee7df] text-sm">
                <RunMetaRow label={t.runs.workflow} value={run.data.workflowId} />
                <RunMetaRow label={t.runs.version} value={run.data.workflowVersionId} />
                <RunMetaRow label={t.runs.trigger} value={run.data.triggerType} />
                <RunMetaRow label={t.runs.createdAt} value={formatDateTime(run.data.createdAt, locale)} />
                <RunMetaRow label={t.runs.event} value={run.data.eventId ?? "not-published"} />
                <RunMetaRow label={t.runs.dataSource} value={isFallback ? "fallback" : "api"} />
              </div>
            </div>

            <div className="border border-[#ded7cf] bg-white">
              <div className="border-b border-[#ded7cf] px-4 py-3">
                <h2 className="text-base font-bold text-[#171412]">[+] {t.runs.input}</h2>
              </div>
              <pre className="max-h-80 overflow-auto p-4 text-xs leading-5 text-[#2f2a26]">{JSON.stringify(run.data.input, null, 2)}</pre>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function RunMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3">
      <span className="text-xs font-semibold uppercase text-[#6b625a]">{label}</span>
      <span className="break-all font-medium text-[#171412]">{value}</span>
    </div>
  );
}
