import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics } from "@agentops/events";
import { BusinessMetrics, logRedactPaths } from "@agentops/observability";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { handleWorkflowEvent } from "./executor";
import { recordPlanMetrics } from "./main";

const base = { workspaceId: "ws_demo", workflowId: "wf_lead", workflowRunId: "run_1" };

function scored(leadScore: number, category: string) {
  return createEvent({
    type: kafkaTopics.agentTaskCompleted,
    ...base,
    payload: {
      nodeId: "ai-1",
      output: { leadScore, category },
      definition: sampleLeadWorkflowDefinition,
      context: { name: "Anna" }
    }
  });
}

describe("business metrics", () => {
  it("counts leads by category and the branch taken", () => {
    const metrics = new BusinessMetrics();
    for (const event of [scored(87, "high-intent"), scored(40, "low-intent"), scored(5, "spam")]) {
      recordPlanMetrics(event, handleWorkflowEvent(event), metrics);
    }

    const text = metrics.render();
    expect(text).toContain('agentops_leads_scored_total{category="high-intent"} 1');
    expect(text).toContain('agentops_leads_scored_total{category="spam"} 1');
    expect(text).toContain('agentops_workflow_branch_total{node_id="condition-1",target="ai-2"} 1');
    expect(text).toContain('agentops_workflow_branch_total{node_id="condition-1",target="end-1"} 2');
  });

  it("counts emails sent to review", () => {
    const metrics = new BusinessMetrics();
    const draft = createEvent({
      type: kafkaTopics.agentTaskCompleted,
      ...base,
      payload: { nodeId: "ai-2", output: { subject: "Hi", body: "Hello" }, definition: sampleLeadWorkflowDefinition, context: { leadScore: 90 } }
    });
    recordPlanMetrics(draft, handleWorkflowEvent(draft), metrics);

    expect(metrics.render()).toContain("agentops_approvals_requested_total 1");
  });
});

describe("structured logs", () => {
  it("redacts contact data and raw run context", () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      }
    });
    const logger = pino({ name: "test", redact: { paths: logRedactPaths, censor: "[REDACTED]" } }, sink);

    logger.info({ workflowRunId: "run_1", requestId: "req_1", email: "anna@shopabc.vn", payload: { context: { phone: "0912345678" } } }, "x");

    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry).toMatchObject({ workflowRunId: "run_1", requestId: "req_1", email: "[REDACTED]" });
    expect(lines[0]).not.toContain("anna@shopabc.vn");
    expect(lines[0]).not.toContain("0912345678");
  });
});
