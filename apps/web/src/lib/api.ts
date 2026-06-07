import type { WorkflowDefinition, WorkflowNodeType, WorkflowRunStatus, WorkflowStatus, WorkflowStepStatus } from "@agentops/shared";

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export type ApiDataSource = "api" | "fallback";

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

export type WorkflowRunView = {
  id: string;
  workflowId: string;
  workspaceId: string;
  workflowVersionId: string;
  status: WorkflowRunStatus;
  triggerType: string;
  input: Record<string, unknown>;
  createdAt: string;
  eventId?: string;
};

export type WorkflowRunStepView = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  status: WorkflowStepStatus;
  message: string;
};

export type WorkflowRunStepsView = {
  workflowRunId: string;
  steps: WorkflowRunStepView[];
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

const sampleDefinition: WorkflowDefinition = {
  nodes: [
    { id: "trigger-1", type: "TRIGGER", name: "Manual lead trigger", config: { triggerType: "manual" } },
    {
      id: "ai-1",
      type: "AI_AGENT",
      name: "Score lead",
      config: {
        modelProvider: "mock",
        outputSchema: {
          type: "object",
          required: ["leadScore", "summary", "recommendedAction"],
          properties: {
            leadScore: { type: "number" },
            summary: { type: "string" },
            recommendedAction: { type: "string" }
          }
        }
      }
    },
    { id: "condition-1", type: "CONDITION", name: "High intent?", config: { expression: "leadScore > 80" } },
    { id: "webhook-1", type: "WEBHOOK", name: "Send follow-up mock", config: { url: "https://example.com/mock" } },
    { id: "end-1", type: "END", name: "Done", config: {} }
  ],
  edges: [
    { id: "edge-1", source: "trigger-1", target: "ai-1" },
    { id: "edge-2", source: "ai-1", target: "condition-1" },
    { id: "edge-3", source: "condition-1", target: "webhook-1", condition: "true" },
    { id: "edge-4", source: "webhook-1", target: "end-1" }
  ]
};

export const fallbackWorkflows: WorkflowView[] = [
  {
    id: "wf_lead_qualification",
    workspaceId: "ws_demo",
    name: "Lead qualification",
    description: "Score a new lead, branch on intent, and send a webhook mock.",
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

export const fallbackRuns: WorkflowRunView[] = [
  {
    id: "run_demo_lead_qualification",
    workflowId: "wf_lead_qualification",
    workspaceId: "ws_demo",
    workflowVersionId: "wfv_demo_lead_qualification",
    status: "RUNNING",
    triggerType: "manual",
    input: {
      leadName: "Demo lead",
      source: "fallback",
      intent: "urgent sales automation"
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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function safeApiGet<T>(path: string, fallback: T): Promise<ApiResource<T>> {
  try {
    return { data: await apiGet<T>(path), source: "api" };
  } catch (error) {
    return {
      data: fallback,
      source: "fallback",
      error: error instanceof Error ? error.message : "API request failed"
    };
  }
}

export async function clientApiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = readBrowserAccessToken();
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-workspace-role": "OWNER",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function readBrowserAccessToken() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return (JSON.parse(window.localStorage.getItem("agentops.auth.v1") ?? "null") as { accessToken?: string } | null)?.accessToken;
  } catch {
    return undefined;
  }
}
