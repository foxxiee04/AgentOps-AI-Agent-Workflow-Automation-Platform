import { kafkaTopics, type EventEnvelope } from "@agentops/events";
import type { WorkflowExecutionPlan } from "./executor";

export type StepStatus = "PENDING" | "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED" | "SKIPPED";
export type RunStatus = "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";

export type StepChange = {
  nodeId: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  errorMessage?: string;
  started?: boolean;
  finished?: boolean;
};

export type RunStateChange = {
  workflowRunId: string;
  workspaceId: string;
  runStatus: RunStatus;
  errorMessage?: string;
  /** undefined = keep the stored context */
  context?: Record<string, unknown>;
  steps: StepChange[];
  approvals: Array<{ nodeId: string; review: unknown }>;
  aiResult?: {
    nodeId: string;
    provider: string;
    modelName: string;
    output: unknown;
    inputTokens: number;
    outputTokens: number;
  };
  toolResult?: { nodeId: string; toolType: string; status: string; output: unknown };
  /** PENDING steps become SKIPPED once the run is finished (branch not taken). */
  skipPending: boolean;
};

/** Pure translation of "event consumed + plan produced" into the database changes for that run. */
export function projectRunState(source: EventEnvelope, plan: WorkflowExecutionPlan): RunStateChange {
  const steps = new Map<string, StepChange>();
  const upsert = (change: StepChange) => steps.set(change.nodeId, { ...steps.get(change.nodeId), ...change });
  const approvals: RunStateChange["approvals"] = [];

  for (const event of plan.startedSteps) {
    const nodeId = String(event.payload["nodeId"]);
    if (event.type === kafkaTopics.workflowStepStarted) {
      const waiting = event.payload["status"] === "WAITING_APPROVAL";
      upsert({ nodeId, status: waiting ? "WAITING_APPROVAL" : "RUNNING", input: event.payload["input"], started: true });
    } else if (event.type === kafkaTopics.workflowStepCompleted) {
      upsert({ nodeId, status: "COMPLETED", output: event.payload["output"], finished: true });
    } else if (event.type === kafkaTopics.workflowStepFailed) {
      upsert({
        nodeId,
        status: "FAILED",
        output: event.payload["output"],
        errorMessage: String(event.payload["message"] ?? "Step failed"),
        finished: true
      });
    }
  }

  for (const request of plan.taskRequests) {
    if (request.type === kafkaTopics.humanApprovalRequested) {
      approvals.push({ nodeId: String(request.payload["nodeId"]), review: request.payload["review"] });
    }
  }

  // A worker dead-lettered this node: record the error on the step itself.
  if (source.type === kafkaTopics.workflowStepFailed) {
    upsert({
      nodeId: String(source.payload["nodeId"]),
      status: "FAILED",
      errorMessage: String(source.payload["message"] ?? "Step failed"),
      finished: true
    });
  }

  const failed = plan.terminalEvents.find((event) => event.type === kafkaTopics.workflowFailed);
  const completed = plan.terminalEvents.some((event) => event.type === kafkaTopics.workflowCompleted);
  let runStatus: RunStatus = "RUNNING";
  if (failed) {
    runStatus = failed.payload["status"] === "CANCELLED" ? "CANCELLED" : "FAILED";
  } else if (completed) {
    runStatus = "COMPLETED";
  } else if (approvals.length > 0) {
    runStatus = "WAITING_APPROVAL";
  }

  return {
    workflowRunId: source.workflowRunId,
    workspaceId: source.workspaceId,
    runStatus,
    errorMessage: failed ? String(failed.payload["message"] ?? "Workflow failed") : undefined,
    context: Object.keys(plan.context).length > 0 ? plan.context : undefined,
    steps: [...steps.values()],
    approvals,
    aiResult:
      source.type === kafkaTopics.agentTaskCompleted
        ? {
            nodeId: String(source.payload["nodeId"]),
            provider: String(source.payload["provider"] ?? "mock"),
            modelName: String(source.payload["modelName"] ?? "unknown"),
            output: source.payload["output"],
            inputTokens: Number((source.payload["tokenUsage"] as { inputTokens?: number } | undefined)?.inputTokens ?? 0),
            outputTokens: Number((source.payload["tokenUsage"] as { outputTokens?: number } | undefined)?.outputTokens ?? 0)
          }
        : undefined,
    toolResult:
      source.type === kafkaTopics.toolCallCompleted
        ? {
            nodeId: String(source.payload["nodeId"]),
            toolType: String(source.payload["toolType"] ?? "unknown"),
            status: String(source.payload["status"] ?? "completed"),
            output: source.payload["output"]
          }
        : undefined,
    skipPending: runStatus === "COMPLETED" || runStatus === "FAILED" || runStatus === "CANCELLED"
  };
}
