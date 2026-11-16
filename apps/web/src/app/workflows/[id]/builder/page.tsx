import { AppShell } from "../../../../components/app-shell";
import { ErrorState } from "../../../../components/data-state";
import { WorkflowBuilder } from "../../../../features/workflow-builder/workflow-builder";
import { fallbackWorkflows, type WorkflowView } from "../../../../lib/api";
import { safeApiGet } from "../../../../lib/server-api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../../../lib/i18n";

export default async function WorkflowBuilderPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: LocaleSearchParams;
}) {
  const { id } = await params;
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const fallbackWorkflow = fallbackWorkflows.find((workflow) => workflow.id === id) ?? fallbackWorkflows[0];
  const workflow = await safeApiGet<WorkflowView>(`/workflows/${id}`, fallbackWorkflow);

  return (
    <AppShell active="builder" locale={locale}>
      <div className="p-5">
        {workflow.source === "error" ? (
          <ErrorState labels={t.states} detail={workflow.error} />
        ) : (
          <WorkflowBuilder
            workflow={workflow.data}
            source={workflow.source}
            labels={{ builder: t.builder, common: t.common }}
            locale={locale}
            invalidMessage={t.workflows.invalidGraph}
          />
        )}
      </div>
    </AppShell>
  );
}
