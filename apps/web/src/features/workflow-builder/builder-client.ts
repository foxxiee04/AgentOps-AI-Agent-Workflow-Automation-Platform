import { clientApiPost, fetchRun, fetchRunSteps, type WorkflowRunView, type WorkflowView } from "../../lib/api";
import { sampleLeadInput } from "../workflows/workflow-actions";

export { fetchRun, fetchRunSteps };
export type { WorkflowRunView, WorkflowView };

export async function publishWorkflow(workflowId: string) {
  return clientApiPost(`/workflows/${workflowId}/publish`, {});
}

export async function runWorkflow(workflowId: string) {
  return clientApiPost<{ run: WorkflowRunView }>(`/workflows/${workflowId}/run`, {
    triggerType: "manual",
    input: sampleLeadInput
  });
}
