import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { StatusPill, type StatusPillTone } from "../../components/status-pill";
import { RunWorkflowButton, PublishWorkflowButton } from "../../features/workflows/workflow-actions";
import { fallbackWorkflows, safeApiGet, type WorkflowView } from "../../lib/api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

const statusTone: Record<WorkflowView["status"], StatusPillTone> = {
  DRAFT: "warning",
  ACTIVE: "success",
  PAUSED: "neutral",
  ARCHIVED: "danger"
};

export default async function WorkflowsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const workflows = await safeApiGet<WorkflowView[]>("/workflows?workspaceId=ws_demo", fallbackWorkflows);

  return (
    <AppShell active="workflows" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d8d0c7] pb-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#6b625a]">{t.workflows.eyebrow}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-[#171412]">{t.workflows.title}</h1>
          </div>
          <Link href={`/workflows/wf_lead_qualification/builder?lang=${locale}`} className="rounded-[4px] bg-[#1d1a18] px-4 py-2 text-sm font-semibold text-[#ffffff]">
            {t.workflows.newWorkflow}
          </Link>
        </div>

        {workflows.source === "fallback" ? (
          <div className="rounded-[4px] border border-[#b45309] bg-[#fff7ed] px-3 py-2 text-sm text-[#7c2d12]">
            [!] {t.workflows.fallback}
          </div>
        ) : null}

        <div className="divide-y divide-[#eee7df] border border-[#ded7cf] bg-white">
          {workflows.data.map((workflow) => (
            <article key={workflow.id} className="bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-[#171412]">{workflow.name}</h2>
                    <StatusPill tone={statusTone[workflow.status]}>{workflow.status}</StatusPill>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-[#4e4742]">{workflow.description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-[#5f5750]">
                    <span>[{t.workflows.nodes}] {workflow.definition.nodes.length}</span>
                    <span>[{t.workflows.edges}] {workflow.definition.edges.length}</span>
                    <span>[{t.workflows.workspace}] {workflow.workspaceId}</span>
                    <span>[{t.workflows.version}] {workflow.currentVersionId ?? "draft"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/workflows/${workflow.id}/builder?lang=${locale}`}
                    className="inline-flex min-h-9 items-center rounded-[4px] border border-[#8f8379] bg-white px-3 text-sm font-semibold text-[#1c1917]"
                  >
                    {t.common.builder}
                  </Link>
                  <PublishWorkflowButton workflowId={workflow.id} labels={t.common} />
                  <RunWorkflowButton workflowId={workflow.id} labels={t.common} locale={locale} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
