import { describe, expect, it } from "vitest";
import { createKafkaInstrumentation } from "./kafka-instrumentation";
import { startOtelSpan } from "./opentelemetry";
import { createTraceparent, parseTraceparent } from "./trace";
import { WorkerMetrics } from "./worker-metrics";
import { AiMetrics, BusinessMetrics } from "./domain-metrics";

describe("startOtelSpan without an OTel SDK", () => {
  it("keeps the caller's trace id instead of the all-zero noop id", () => {
    const parent = createTraceparent("0123456789abcdef0123456789abcdef");
    const span = startOtelSpan("test", { traceparent: parent });

    expect(span.traceId).toBe("0123456789abcdef0123456789abcdef");
    expect(parseTraceparent(span.traceparent)?.traceId).toBe("0123456789abcdef0123456789abcdef");
    span.span.end();
  });

  it("creates a fresh trace id when there is no parent", () => {
    const span = startOtelSpan("test");
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.traceId).not.toMatch(/^0+$/);
    span.span.end();
  });
});

describe("createKafkaInstrumentation", () => {
  it("passes the message through and returns the processing outcome", async () => {
    const instrument = createKafkaInstrumentation("agentops.test");
    const value = JSON.stringify({ eventId: "evt_1", traceId: "0123456789abcdef0123456789abcdef", payload: { nodeId: "ai-1" } });
    let received = "";

    const outcome = await instrument("agent-task-requested", value, async (traced) => {
      received = traced;
      return { status: "processed" };
    });

    expect(outcome.status).toBe("processed");
    expect(JSON.parse(received)).toMatchObject({ eventId: "evt_1", traceId: "0123456789abcdef0123456789abcdef" });
  });

  it("still runs the handler for values that are not JSON", async () => {
    const instrument = createKafkaInstrumentation("agentops.test");
    const outcome = await instrument("agent-task-requested", "{broken", async (traced) => ({ status: traced === "{broken" ? "dead_lettered" : "x" }));
    expect(outcome.status).toBe("dead_lettered");
  });
});

describe("WorkerMetrics.recordOutcome", () => {
  it("counts outcomes and dead letters", () => {
    const metrics = new WorkerMetrics("ai-worker");
    metrics.recordOutcome("agent-task-requested", "agentops.ai-worker", { status: "processed" }, 12);
    metrics.recordOutcome("agent-task-requested", "agentops.ai-worker", { status: "dead_lettered", error: "boom" }, 30);

    const text = metrics.render();
    expect(text).toContain('agentops_worker_message_outcomes_total{worker="ai-worker",topic="agent-task-requested",group_id="agentops.ai-worker",outcome="processed"} 1');
    expect(text).toContain('agentops_worker_dead_letters_total{worker="ai-worker",topic="agent-task-requested",group_id="agentops.ai-worker"} 1');
  });
});

describe("domain metrics", () => {
  it("exposes known business series at 0 before the first event", () => {
    const text = new BusinessMetrics().render();
    expect(text).toContain('agentops_leads_scored_total{category="spam"} 0');
    expect(text).toContain('agentops_sales_tasks_created_total{kind="SALES_TASK"} 0');
  });

  it("records AI calls, tokens, cost, JSON validity and retries", () => {
    const metrics = new AiMetrics();
    metrics.record({
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
      inputTokens: 300,
      outputTokens: 60,
      costUsd: 0.000081,
      durationMs: 900,
      validOutputs: 1,
      invalidOutputs: 2
    });

    const text = metrics.render();
    expect(text).toContain('agentops_ai_calls_total{provider="openai",model="gpt-4o-mini",status="success"} 1');
    expect(text).toContain('agentops_ai_calls_total{provider="openai",model="gpt-4o-mini",status="quota_exceeded"} 0');
    expect(text).toContain('agentops_ai_tokens_total{provider="openai",model="gpt-4o-mini",direction="input"} 300');
    expect(text).toContain('agentops_ai_output_validation_total{provider="openai",model="gpt-4o-mini",result="invalid"} 2');
    expect(text).toContain('agentops_ai_retries_total{provider="openai",model="gpt-4o-mini"} 2');
    expect(text).toContain("agentops_ai_estimated_cost_usd_total");
  });
});
