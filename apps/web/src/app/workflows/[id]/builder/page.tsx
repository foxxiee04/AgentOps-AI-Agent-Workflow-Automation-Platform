import { AppShell } from "../../../../components/app-shell";
import { WorkflowBuilder } from "../../../../features/workflow-builder/workflow-builder";

export default function WorkflowBuilderPage() {
  return (
    <AppShell active="Builder">
      <div className="p-5">
        <WorkflowBuilder />
      </div>
    </AppShell>
  );
}

