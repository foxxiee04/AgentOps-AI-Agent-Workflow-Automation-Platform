import { apiUrl, readError, type WorkflowRunView } from "../../lib/api";

async function request(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: "include" });
  if (!response.ok) {
    throw await readError(response);
  }
  return response;
}

export async function runWorkflow(workflowId: string, input: Record<string, unknown>): Promise<WorkflowRunView> {
  const response = await request(`/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ triggerType: "manual", input })
  });
  const body = (await response.json()) as { run: WorkflowRunView };
  return body.run;
}

export async function publishWorkflow(workflowId: string): Promise<void> {
  await request(`/workflows/${encodeURIComponent(workflowId)}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  await request(`/workflows/${encodeURIComponent(workflowId)}`, { method: "DELETE" });
}
