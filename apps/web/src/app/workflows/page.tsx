import { AppShell } from "../../components/app-shell";
import { StatusPill, type StatusPillTone } from "../../components/status-pill";
import { DataNotice, EmptyState, ErrorState } from "../../components/data-state";
import { CreateFromTemplateButton, WorkflowCard } from "../../features/workflows/workflow-actions";
import { WorkflowsHeading, WorkflowStagger } from "../../features/workflows/workflow-motion";
import { fallbackWorkflows, type WorkflowView } from "../../lib/api";
import { safeApiGet } from "../../lib/server-api";
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
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.workflows.eyebrow}</p>
            <WorkflowsHeading>{t.workflows.title}</WorkflowsHeading>
          </div>
          <CreateFromTemplateButton labels={t.workflows} locale={locale} />
        </div>

        <DataNotice resource={workflows} labels={t.states} />

        {workflows.source === "error" ? (
          <ErrorState labels={t.states} detail={workflows.error} />
        ) : workflows.data.length === 0 ? (
          <EmptyState title={t.states.emptyTitle} body={t.workflows.empty} />
        ) : (
        <WorkflowStagger className="divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)] bg-white">
          {workflows.data.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflowId={workflow.id}
              status={workflow.status}
              currentVersionId={workflow.currentVersionId}
              definition={workflow.definition}
              locale={locale}
              labels={t.common}
              invalidMessage={t.workflows.invalidGraph}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--ink-deep)]">{workflow.name}</h2>
                  <StatusPill tone={statusTone[workflow.status]}>{workflow.status}</StatusPill>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-[var(--body)]">{workflow.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-[var(--mute)]">
                  <span>[{t.workflows.nodes}] {workflow.definition.nodes.length}</span>
                  <span>[{t.workflows.edges}] {workflow.definition.edges.length}</span>
                  <span>[{t.workflows.workspace}] {workflow.workspaceId}</span>
                  <span>[{t.workflows.version}] {workflow.currentVersionId ?? "draft"}</span>
                </div>
              </div>
            </WorkflowCard>
          ))}
        </WorkflowStagger>
        )}
      </div>
    </AppShell>
  );
}
