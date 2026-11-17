import {
  approvalDecisionResultSchema,
  humanApprovalViewSchema,
  sampleLeadWorkflowDefinition,
  workflowRunStepsViewSchema,
  workflowRunViewSchema,
  type ApprovalDecision,
  type ApprovalDecisionResult,
  type HumanApprovalView,
  type WorkflowDefinition,
  type WorkflowRunStepView,
  type WorkflowRunStepsView,
  type WorkflowRunView,
  type WorkflowStatus
} from "@agentops/shared";
import { z } from "zod";
import { readPublicApiUrl, resolvePublicApiUrl } from "./runtime-config";

export type { HumanApprovalView, WorkflowRunStepView, WorkflowRunStepsView, WorkflowRunView };

export const apiUrl = readPublicApiUrl();
export const serverApiUrl = (process.env.API_INTERNAL_URL ?? resolvePublicApiUrl()).replace(/\/$/, "");

/** Demo data is shown only when explicitly enabled; otherwise an unreachable API is an error state. */
export function isDemoFallbackEnabled(env: Record<string, string | undefined> = { NEXT_PUBLIC_DEMO_FALLBACK: process.env.NEXT_PUBLIC_DEMO_FALLBACK }) {
  return env["NEXT_PUBLIC_DEMO_FALLBACK"] === "true";
}

export type ApiDataSource = "api" | "fallback" | "error";

export type ApiResource<T> = {
  data: T;
  source: ApiDataSource;
  error?: string;
};

export type DashboardOverview = {
  activeWorkflows: number;
  totalWorkflows: number;
  runsToday: number;
  failedRuns: number;
  aiTokensUsed: number;
};

export type ReadinessStatus = "ready" | "warning" | "blocked" | "planned";

export type DashboardReadiness = {
  generatedAt: string;
  workspaceId: string;
  summary: Record<ReadinessStatus, number>;
  items: Array<{
    id: string;
    label: string;
    status: ReadinessStatus;
    summary: string;
    action: string;
  }>;
  nextActions: string[];
};

export type WorkflowView = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  currentVersionId?: string;
  createdBy: string;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
};

export type RecentActivity = {
  eventId: string;
  type: string;
  workspaceId: string;
  workflowId?: string;
  workflowRunId?: string;
  createdAt: string;
};

export type HealthReady = {
  status: string;
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
  details?: Record<string, { status: string; message?: string }>;
};

export type AiProviders = {
  defaultProvider: string;
  providers: Array<{
    id: string;
    status: "ready" | "configured" | "missing_api_key" | "planned" | string;
    defaultModel: string;
    supportsStructuredOutput: boolean;
  }>;
};

export type AiUsage = {
  workspaceId: string;
  dailyAiCallLimit: number;
  aiCallsToday: number;
  tokensUsedToday: number;
  notes: string;
};

export type AiTestResult = {
  provider: string;
  modelName: string;
  result: Record<string, unknown>;
  validation: {
    schemaValid: boolean;
    errors: string[];
  };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
};

const sampleDefinition: WorkflowDefinition = sampleLeadWorkflowDefinition;

export const fallbackWorkflows: WorkflowView[] = [
  {
    id: "wf_lead_qualification",
    workspaceId: "ws_demo",
    name: "Lead qualification",
    description: "Score a new lead, branch on intent, draft an email for approval, and create a sales task.",
    status: "DRAFT",
    createdBy: "user_demo",
    definition: sampleDefinition,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z"
  }
];

export const fallbackOverview: DashboardOverview = {
  activeWorkflows: 0,
  totalWorkflows: 1,
  runsToday: 0,
  failedRuns: 0,
  aiTokensUsed: 0
};

export const fallbackReadiness: DashboardReadiness = {
  generatedAt: "2026-06-07T00:00:00.000Z",
  workspaceId: "ws_demo",
  summary: {
    ready: 1,
    warning: 4,
    blocked: 0,
    planned: 0
  },
  items: [
    {
      id: "workflow-publishing",
      label: "Workflow publishing",
      status: "warning",
      summary: "No active workflow is available for live demo runs yet.",
      action: "Publish the lead qualification workflow and run it once from the Workflows screen."
    },
    {
      id: "event-pipeline",
      label: "Event pipeline",
      status: "warning",
      summary: "No recent domain events have been recorded in memory.",
      action: "Trigger a workflow run to verify Kafka event publishing and worker logs."
    },
    {
      id: "ai-provider",
      label: "AI provider",
      status: "warning",
      summary: "Only the mock AI provider is ready; real provider execution is not configured.",
      action: "Set OPENAI_API_KEY or GEMINI_API_KEY when moving beyond mock lead scoring."
    },
    {
      id: "observability",
      label: "Observability",
      status: "warning",
      summary: "OpenTelemetry export is disabled.",
      action: "Set OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_TRACES_ENDPOINT for local Tempo traces."
    },
    {
      id: "production-secrets",
      label: "Production secrets",
      status: "ready",
      summary: "Fallback mode cannot inspect local JWT secrets.",
      action: "Start the API to inspect runtime secret readiness."
    }
  ],
  nextActions: [
    "Publish the lead qualification workflow and run it once from the Workflows screen.",
    "Trigger a workflow run to verify Kafka event publishing and worker logs.",
    "Set OPENAI_API_KEY or GEMINI_API_KEY when moving beyond mock lead scoring.",
    "Set OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_TRACES_ENDPOINT for local Tempo traces."
  ]
};

export const fallbackRuns: WorkflowRunView[] = [
  {
    id: "run_demo_lead_qualification",
    workflowId: "wf_lead_qualification",
    workspaceId: "ws_demo",
    workflowVersionId: "wfv_demo_lead_qualification",
    status: "RUNNING",
    triggerType: "webhook",
    input: {
      name: "Demo lead",
      company: "Shop ABC",
      email: "de***@example.com",
      message: "We need chat automation and order tracking.",
      source: "fallback"
    },
    createdAt: "2026-06-07T00:00:00.000Z",
    eventId: "evt_demo_workflow_triggered"
  }
];

export function fallbackRunForId(id: string): WorkflowRunView {
  return fallbackRuns.find((run) => run.id === id) ?? { ...fallbackRuns[0], id };
}

export function fallbackStepsForRun(id: string): WorkflowRunStepsView {
  return {
    workflowRunId: id,
    steps: sampleDefinition.nodes.map((node, index) => ({
      id: `${id}_${node.id}`,
      workflowRunId: id,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: index === 0 ? "COMPLETED" : "PENDING",
      retryCount: 0,
      message:
        index === 0
          ? "Trigger accepted by API and workflow event published."
          : "Waiting for workflow-worker execution in the async pipeline."
    }))
  };
}

export function sortWorkflowRunsNewestFirst<T extends Pick<WorkflowRunView, "createdAt">>(runs: T[]): T[] {
  return [...runs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const fallbackActivity: RecentActivity[] = [];

export const fallbackHealth: HealthReady = {
  status: "offline",
  details: {
    api: { status: "down", message: "API fallback data is being displayed." }
  }
};

export const fallbackProviders: AiProviders = {
  defaultProvider: "mock",
  providers: [
    { id: "mock", status: "ready", defaultModel: "mock-lead-scorer", supportsStructuredOutput: true },
    { id: "openai", status: "missing_api_key", defaultModel: "gpt-4o-mini", supportsStructuredOutput: true },
    { id: "gemini", status: "planned", defaultModel: "gemini-placeholder", supportsStructuredOutput: true }
  ]
};

export const fallbackAiUsage: AiUsage = {
  workspaceId: "ws_demo",
  dailyAiCallLimit: 100,
  aiCallsToday: 1,
  tokensUsedToday: 0,
  notes: "Fallback UI data. Start the API to load live workspace usage."
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export async function readError(response: Response): Promise<ApiError> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { message?: string | string[]; details?: unknown };
    const message = Array.isArray(body.message) ? body.message.join("; ") : body.message;
    return new ApiError(response.status, message || `API request failed: ${response.status}`, body.details);
  } catch {
    return new ApiError(response.status, text || `API request failed: ${response.status}`);
  }
}

/**
 * Readiness-aware variant of `safeApiGet` (in `server-api.ts`). `/health/ready` answers HTTP 503 with a JSON report
 * ({ status, info, error, details }) when a dependency is down; that body is real API data, not an
 * unreachable API, so it is returned as `source: "api"` and the per-dependency detail is kept.
 */
export async function safeHealthGet<T>(path: string, fallback: T, schema?: z.ZodType<T>): Promise<ApiResource<T>> {
  try {
    const response = await fetch(`${serverApiUrl}${path}`, { cache: "no-store" });
    if (response.status === 503) {
      const body = await response
        .clone()
        .json()
        .catch(() => undefined);
      // The API's exception filter wraps Terminus' report: { statusCode, error, details, ... } (no `status`).
      if (body && typeof body === "object" && ("status" in body || "details" in body)) {
        const report = "status" in body ? body : { status: "error", error: (body as { error?: unknown }).error, details: (body as { details?: unknown }).details };
        return { data: schema ? schema.parse(report) : (report as T), source: "api" };
      }
    }
    if (!response.ok) {
      throw await readError(response);
    }
    const body = (await response.json()) as unknown;
    return { data: schema ? schema.parse(body) : (body as T), source: "api" };
  } catch (error) {
    return {
      data: fallback,
      source: isDemoFallbackEnabled() ? "fallback" : "error",
      error: error instanceof Error ? error.message : "API request failed"
    };
  }
}

let refreshing: Promise<boolean> | undefined;
/** Rotates the HttpOnly session cookies via the refresh cookie; concurrent callers share one request. */
export function refreshBrowserSession(): Promise<boolean> {
  refreshing ??= fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  })
    .then((response) => response.ok, () => false)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

async function fetchWithSession(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: "include" });
  if (response.status === 401 && (await refreshBrowserSession())) {
    return fetch(`${apiUrl}${path}`, { ...init, credentials: "include" });
  }
  return response;
}

export async function clientApiGet<T>(path: string, schema?: z.ZodType<T>): Promise<T> {
  const response = await fetchWithSession(path, { cache: "no-store" });
  if (!response.ok) {
    throw await readError(response);
  }
  const body = (await response.json()) as unknown;
  return schema ? schema.parse(body) : (body as T);
}

export async function clientApiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetchWithSession(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<T>;
}

export const runSchemas = {
  run: workflowRunViewSchema,
  steps: workflowRunStepsViewSchema,
  approvals: z.array(humanApprovalViewSchema)
};

export function fetchRun(runId: string) {
  return clientApiGet(`/workflow-runs/${encodeURIComponent(runId)}`, workflowRunViewSchema);
}

export function fetchRunSteps(runId: string) {
  return clientApiGet(`/workflow-runs/${encodeURIComponent(runId)}/steps`, workflowRunStepsViewSchema);
}

export function fetchPendingApprovals(workspaceId: string) {
  return clientApiGet(`/workflow-runs/approvals?workspaceId=${encodeURIComponent(workspaceId)}`, runSchemas.approvals);
}

/** The email a reviewer edited before approving. */
export type ApprovalEditedEmail = { subject: string; body: string };

/**
 * Body of an approval decision: the shared decision (a `comment` is optional for approve,
 * mandatory for reject) plus the draft the reviewer edited.
 */
export type ApprovalDecisionRequest = {
  decision: ApprovalDecision["decision"];
  comment?: ApprovalDecision["comment"];
  editedEmail?: ApprovalEditedEmail;
};

export async function decideApproval(approval: Pick<HumanApprovalView, "workflowRunId" | "stepId">, decision: ApprovalDecisionRequest): Promise<ApprovalDecisionResult> {
  const result = await clientApiPost<unknown>(
    `/workflow-runs/${encodeURIComponent(approval.workflowRunId)}/steps/${encodeURIComponent(approval.stepId)}/approval`,
    decision
  );
  return approvalDecisionResultSchema.parse(result);
}

/** Maps API failures of an approval decision to the i18n key the UI shows. */
export function approvalErrorKey(error: unknown): "conflict" | "forbidden" | "unauthorized" | "failed" {
  if (error instanceof ApiError) {
    if (error.status === 409) return "conflict";
    if (error.status === 403) return "forbidden";
    if (error.status === 401) return "unauthorized";
  }
  return "failed";
}
