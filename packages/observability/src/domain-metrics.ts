import { CounterMetric, HistogramMetric } from "./metrics";

export type MetricsRenderable = { render(): string };

export type AiCallRecord = {
  provider: string;
  model: string;
  /** success | invalid_output | error | quota_exceeded */
  status: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  /** provider responses whose JSON passed / failed schema validation */
  validOutputs: number;
  invalidOutputs: number;
};

/** AI worker metrics: calls, tokens, estimated cost, JSON validity and retries. */
export class AiMetrics implements MetricsRenderable {
  private readonly calls = new CounterMetric("agentops_ai_calls_total", "AI node executions by provider, model and outcome.", [
    "provider",
    "model",
    "status"
  ]);
  private readonly tokens = new CounterMetric("agentops_ai_tokens_total", "AI tokens consumed, by direction (input/output).", [
    "provider",
    "model",
    "direction"
  ]);
  private readonly cost = new CounterMetric(
    "agentops_ai_estimated_cost_usd_total",
    "Estimated AI spend in USD from the model price table (estimate, not billing data).",
    ["provider", "model"]
  );
  private readonly outputs = new CounterMetric(
    "agentops_ai_output_validation_total",
    "Provider responses by JSON Schema validation result (valid/invalid).",
    ["provider", "model", "result"]
  );
  private readonly retries = new CounterMetric("agentops_ai_retries_total", "Extra provider attempts caused by invalid output.", [
    "provider",
    "model"
  ]);
  private readonly duration = new HistogramMetric(
    "agentops_ai_call_duration_seconds",
    "Duration of an AI node execution including retries.",
    ["provider", "model"],
    [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 15, 30, 60]
  );

  private readonly seen = new Set<string>();

  record(call: AiCallRecord) {
    const labels = { provider: call.provider, model: call.model };
    this.initialize(labels);
    this.calls.inc({ ...labels, status: call.status });
    this.tokens.inc({ ...labels, direction: "input" }, call.inputTokens);
    this.tokens.inc({ ...labels, direction: "output" }, call.outputTokens);
    this.cost.inc(labels, call.costUsd);
    if (call.validOutputs > 0) this.outputs.inc({ ...labels, result: "valid" }, call.validOutputs);
    if (call.invalidOutputs > 0) this.outputs.inc({ ...labels, result: "invalid" }, call.invalidOutputs);
    const attempts = call.validOutputs + call.invalidOutputs;
    if (attempts > 1) this.retries.inc(labels, attempts - 1);
    this.duration.observe(labels, call.durationMs / 1000);
  }

  /** Creates a provider/model's series at 0 (call at startup for the models in use). */
  prime(provider: string, model: string) {
    this.initialize({ provider, model });
    return this;
  }

  /** First time a provider/model shows up, create its series at 0 so later increase() works. */
  private initialize(labels: { provider: string; model: string }) {
    const key = `${labels.provider}|${labels.model}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    for (const status of ["success", "invalid_output", "error", "quota_exceeded"]) this.calls.inc({ ...labels, status }, 0);
    for (const direction of ["input", "output"]) this.tokens.inc({ ...labels, direction }, 0);
    for (const result of ["valid", "invalid"]) this.outputs.inc({ ...labels, result }, 0);
    this.cost.inc(labels, 0);
    this.retries.inc(labels, 0);
  }

  render() {
    return [this.calls, this.tokens, this.cost, this.outputs, this.retries, this.duration].map((metric) => metric.render()).join("\n\n");
  }
}

/** Lead-flow business metrics emitted by the workflow and notification workers. */
export class BusinessMetrics implements MetricsRenderable {
  private readonly leadsScored = new CounterMetric("agentops_leads_scored_total", "Leads scored by the AI, by category.", ["category"]);
  // No workflow_id label: it is unbounded, and unknown label sets cannot be pre-initialised.
  private readonly branches = new CounterMetric(
    "agentops_workflow_branch_total",
    "Condition node decisions by target node (lead template: ai-2 = email path A, end-1 = path B).",
    ["node_id", "target"]
  );
  private readonly approvalsRequested = new CounterMetric("agentops_approvals_requested_total", "Emails sent to human review.", []);
  private readonly salesTasks = new CounterMetric("agentops_sales_tasks_created_total", "Follow-up tasks created for sales.", ["kind"]);

  constructor() {
    // Known label sets start at 0 so increase()/rate() see the first events after a restart.
    for (const category of ["high-intent", "low-intent", "spam"]) {
      this.leadsScored.inc({ category }, 0);
    }
    this.salesTasks.inc({ kind: "SALES_TASK" }, 0);
    this.branches.inc({ node_id: "condition-1", target: "ai-2" }, 0);
    this.branches.inc({ node_id: "condition-1", target: "end-1" }, 0);
    this.approvalsRequested.inc({}, 0);
  }

  leadScored(category: string) {
    this.leadsScored.inc({ category });
  }

  branchTaken(nodeId: string, target: string) {
    this.branches.inc({ node_id: nodeId, target });
  }

  approvalRequested() {
    this.approvalsRequested.inc({});
  }

  salesTaskCreated(kind: string) {
    this.salesTasks.inc({ kind });
  }

  render() {
    return [this.leadsScored, this.branches, this.approvalsRequested, this.salesTasks].map((metric) => metric.render()).join("\n\n");
  }
}

/** pino `redact` paths: contact data and raw run context never reach the logs, even by accident. */
export const logRedactPaths = [
  "email",
  "phone",
  "*.email",
  "*.phone",
  "input",
  "*.input",
  "context",
  "*.context",
  "payload.input",
  "payload.context",
  "authorization",
  "*.authorization",
  "apiKey",
  "*.apiKey"
];
