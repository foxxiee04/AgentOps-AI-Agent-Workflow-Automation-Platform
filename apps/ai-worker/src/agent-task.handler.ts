import {
  agentTaskRequestedPayloadSchema,
  createEvent,
  eventEnvelopeSchema,
  kafkaTopics,
  traceContextFromEvent,
  type EventEnvelope
} from "@agentops/events";
import { aiAgentNodeConfigSchema, applyLeadScoringGuardrail, estimateAiCostUsd, type AiProvider } from "@agentops/shared";
import { withOtelSpan, type AiCallRecord, type AiMetrics } from "@agentops/observability";
import { AiOutputValidationError, createProvider, executeAgentTask, type AiProviderClient } from "./ai-task.executor";
import { applyProviderOverride } from "./provider-override";
import { AiQuotaExceededError, type AiUsageGuard } from "./usage-guard";

export type AgentTaskDeps = {
  usage?: AiUsageGuard;
  providerFactory?: (provider: AiProvider) => AiProviderClient;
  metrics?: Pick<AiMetrics, "record">;
};

export async function handleAgentTaskRequested(rawEvent: unknown, deps: AgentTaskDeps = {}): Promise<EventEnvelope> {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = agentTaskRequestedPayloadSchema.parse(event.payload);
  const nodeConfig = applyProviderOverride(payload.config);
  const parsedConfig = aiAgentNodeConfigSchema.safeParse(nodeConfig);
  const provider = parsedConfig.success ? parsedConfig.data.modelProvider : "unknown";
  const model = parsedConfig.success ? parsedConfig.data.modelName : "unknown";
  const startedAt = Date.now();
  const record = (call: Partial<AiCallRecord> & Pick<AiCallRecord, "status">) =>
    deps.metrics?.record({
      provider,
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      validOutputs: 0,
      invalidOutputs: 0,
      durationMs: Date.now() - startedAt,
      ...call
    });

  try {
    await deps.usage?.assertWithinQuota(event.workspaceId);
  } catch (error) {
    record({ status: error instanceof AiQuotaExceededError ? "quota_exceeded" : "error" });
    throw error;
  }

  let result: Awaited<ReturnType<typeof executeAgentTask>>;
  try {
    result = await withOtelSpan(
      "ai.call",
      { attributes: { "gen_ai.system": provider, "gen_ai.request.model": model, "agentops.node_id": payload.nodeId, "agentops.workflow_run_id": event.workflowRunId } },
      async (span) => {
        const executed = await executeAgentTask({ input: payload.input, config: nodeConfig }, deps.providerFactory ?? createProvider);
        span.setAttribute("gen_ai.usage.input_tokens", executed.tokenUsage.inputTokens);
        span.setAttribute("gen_ai.usage.output_tokens", executed.tokenUsage.outputTokens);
        span.setAttribute("agentops.ai.attempts", executed.attempts);
        return executed;
      }
    );
  } catch (error) {
    // Tokens spent on invalid attempts still count against the quota.
    if (error instanceof AiOutputValidationError) {
      const { inputTokens, outputTokens } = error.tokenUsage;
      await deps.usage?.record(event.workspaceId, event.workflowRunId, inputTokens + outputTokens);
      record({
        status: "invalid_output",
        inputTokens,
        outputTokens,
        costUsd: estimateAiCostUsd(provider, model, inputTokens, outputTokens),
        invalidOutputs: error.attempts
      });
    } else {
      record({ status: "error" });
    }
    throw error;
  }

  const { inputTokens, outputTokens } = result.tokenUsage;
  await deps.usage?.record(event.workspaceId, event.workflowRunId, inputTokens + outputTokens);
  record({
    status: "success",
    inputTokens,
    outputTokens,
    costUsd: estimateAiCostUsd(provider, model, inputTokens, outputTokens),
    validOutputs: 1,
    invalidOutputs: result.attempts - 1
  });

  const guarded =
    typeof result.output["leadScore"] === "number"
      ? applyLeadScoringGuardrail(result.output, payload.input)
      : { output: result.output, triggered: false };

  return createEvent({
    type: kafkaTopics.agentTaskCompleted,
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    ...traceContextFromEvent(event),
    payload: {
      nodeId: payload.nodeId,
      taskId: payload.taskId,
      output: guarded.output,
      tokenUsage: result.tokenUsage,
      provider: result.provider,
      modelName: result.modelName,
      latencyMs: result.latencyMs,
      attempts: result.attempts,
      validation: result.validation,
      ...(guarded.triggered ? { guardrail: "prompt_injection" as const } : {}),
      definition: payload.definition,
      context: payload.context
    }
  });
}
