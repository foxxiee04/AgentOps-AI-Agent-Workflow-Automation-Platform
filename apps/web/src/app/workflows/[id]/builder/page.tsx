import { AppShell } from "../../../../components/app-shell";
import { WorkflowBuilder } from "../../../../features/workflow-builder/workflow-builder";
import { fallbackWorkflows, safeApiGet, type WorkflowView } from "../../../../lib/api";
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
        <WorkflowBuilder workflow={workflow.data} source={workflow.source} labels={{ builder: t.builder, common: t.common }} locale={locale} />
      </div>
    </AppShell>
  );
}
