import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sampleLeadWorkflowDefinition, type HumanApprovalView, type WorkflowRunStepView } from "@agentops/shared";
import { appCopy } from "../lib/i18n";
import { ApiError } from "../lib/api";
import { ApprovalCard } from "./approvals/approval-card";
import { conflictApproval } from "./approvals/approval-queue";
import { LeadTable, SalesTaskList } from "./leads/lead-panels";
import { StepTimeline } from "./runs/step-timeline";
import { edgeStyle, knownPositions } from "./workflow-builder/workflow-builder";

const en = appCopy.en;

const approval: HumanApprovalView = {
  id: "apr_1",
  workspaceId: "ws_demo",
  workflowRunId: "run_1",
  nodeId: "approval-1",
  stepId: "run_1_approval-1",
  status: "WAITING_APPROVAL",
  review: {
    lead: { name: "Anna", email: "an***@shopabc.vn" },
    assessment: { leadScore: 87, category: "high-intent", summary: "Needs chat automation" },
    email: { subject: "Automating Shop ABC", body: "Hi Anna, thanks for reaching out." }
  },
  requestedAt: "2026-10-18T08:00:00.000Z"
};

function renderCard(overrides: Partial<HumanApprovalView> = {}, state: { status: "idle" | "working" | "done" | "error"; message?: string } = { status: "idle" }) {
  return renderToStaticMarkup(
    <ApprovalCard
      approval={{ ...approval, ...overrides }}
      labels={en.approvals}
      locale="en"
      comment=""
      state={state}
      onCommentChange={() => undefined}
      onDecide={() => undefined}
    />
  );
}

describe("ApprovalCard", () => {
  it("shows the masked lead, the AI assessment, the draft email and both decision buttons", () => {
    const html = renderCard();

    expect(html).toContain("an***@shopabc.vn");
    expect(html).not.toContain("anna@shopabc.vn");
    expect(html).toContain("Automating Shop ABC");
    expect(html).toContain("Hi Anna, thanks for reaching out.");
    expect(html).toContain("87");
    expect(html).toContain(en.approvals.approve);
    expect(html).toContain(en.approvals.reject);
    expect(html).toContain(`for="comment-apr_1"`);
  });

  it("hides the buttons once the step is decided and shows the result", () => {
    const html = renderCard({ status: "APPROVED" }, { status: "done", message: en.approvals.approved });

    expect(html).not.toContain(en.approvals.reject);
    expect(html).toContain(en.approvals.approved);
  });

  it("disables the buttons while the decision is being sent", () => {
    const html = renderCard({}, { status: "working" });
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain(en.approvals.working);
  });

  it("announces errors with role=alert", () => {
    expect(renderCard({}, { status: "error", message: en.approvals.conflict })).toContain('role="alert"');
  });
});

describe("conflictApproval", () => {
  it("returns the current approval view from a 409 error's details", () => {
    const view = conflictApproval(new ApiError(409, "Someone already decided this step.", { ...approval, status: "APPROVED" }));
    expect(view).toMatchObject({ id: "apr_1", status: "APPROVED" });
  });

  it("returns undefined for other statuses or when details is not an approval view", () => {
    expect(conflictApproval(new ApiError(403, "forbidden", { ...approval, status: "APPROVED" }))).toBeUndefined();
    expect(conflictApproval(new ApiError(409, "bad details", { nope: true }))).toBeUndefined();
    expect(conflictApproval(new Error("network"))).toBeUndefined();
  });
});

describe("StepTimeline", () => {
  const steps: WorkflowRunStepView[] = [
    {
      id: "run_1_ai-1",
      workflowRunId: "run_1",
      nodeId: "ai-1",
      nodeName: "Score lead",
      nodeType: "AI_AGENT",
      status: "COMPLETED",
      message: "API says completed",
      input: { email: "an***@shopabc.vn" },
      output: { leadScore: 87 },
      durationMs: 1500,
      retryCount: 0,
      tokenUsage: { provider: "openai", modelName: "gpt-4o-mini", inputTokens: 210, outputTokens: 58 }
    },
    {
      id: "run_1_email-1",
      workflowRunId: "run_1",
      nodeId: "email-1",
      nodeType: "EMAIL_MOCK",
      nodeName: "Send email (mock)",
      status: "FAILED",
      message: "API says failed",
      errorMessage: "simulated outage",
      retryCount: 2
    },
    {
      id: "run_1_approval-1",
      workflowRunId: "run_1",
      nodeId: "approval-1",
      nodeType: "HUMAN_APPROVAL",
      nodeName: "Human approval",
      status: "WAITING_APPROVAL",
      message: "API says waiting",
      retryCount: 0
    }
  ];

  it("renders a localized status message instead of the API message, plus tokens, duration, masked input, output and errors", () => {
    const html = renderToStaticMarkup(<StepTimeline steps={steps} labels={en.timeline} />);

    expect(html).toContain("Score lead");
    expect(html).toContain("gpt-4o-mini");
    expect(html).toContain("210 in / 58 out");
    expect(html).toContain("1.5 s");
    expect(html).toContain("an***@shopabc.vn");
    expect(html).toContain("&quot;leadScore&quot;: 87");
    expect(html).toContain("simulated outage");
    expect(html).toContain(`${en.timeline.retries}: </dt><dd class="inline text-[var(--ink)]">2`);
    expect(html).toContain("COMPLETED");
    expect(html).toContain("FAILED");
    expect(html).toContain(en.timeline.statusMessages.COMPLETED);
    expect(html).toContain(en.timeline.statusMessages.WAITING_APPROVAL);
    expect(html).not.toContain("API says completed");
    expect(html).not.toContain("API says waiting");
  });
});

describe("lead panels", () => {
  it("renders scored leads and sales tasks, or their empty states", () => {
    const leadsHtml = renderToStaticMarkup(
      <LeadTable
        leads={[{ workflowRunId: "run_1", scoredAt: "2026-10-18T08:00:00Z", name: "Anna", leadScore: 87, category: "high-intent", modelName: "gpt-4o-mini" }]}
        labels={en.dashboard}
        locale="en"
      />
    );
    expect(leadsHtml).toContain("Anna");
    expect(leadsHtml).toContain("high-intent");

    expect(renderToStaticMarkup(<LeadTable leads={[]} labels={en.dashboard} locale="en" />)).toContain(en.dashboard.noLeads);
    expect(renderToStaticMarkup(<SalesTaskList tasks={[]} labels={en.dashboard} locale="en" />)).toContain(en.dashboard.noTasks.replace("'", "&#x27;"));
  });

  it("renders only the first `limit` leads plus a 'more' footer", () => {
    const leads = Array.from({ length: 3 }, (_, index) => ({
      workflowRunId: `run_${index}`,
      scoredAt: "2026-10-18T08:00:00Z",
      name: `Lead ${index}`,
      leadScore: 50 + index,
      category: "high-intent",
      modelName: "gpt-4o-mini"
    }));

    const html = renderToStaticMarkup(<LeadTable leads={leads} labels={en.dashboard} locale="en" limit={2} />);

    expect(html).toContain("Lead 0");
    expect(html).toContain("Lead 1");
    expect(html).not.toContain("Lead 2");
    expect(html).toContain(`+ ${en.dashboard.more.replace("{n}", "1")}`);
  });

  it("renders only the first `limit` sales tasks plus a 'more' footer", () => {
    const tasks = Array.from({ length: 3 }, (_, index) => ({
      id: `task_${index}`,
      title: `Task ${index}`,
      body: "Follow up",
      status: "UNREAD",
      createdAt: "2026-10-18T08:00:00Z"
    }));

    const html = renderToStaticMarkup(<SalesTaskList tasks={tasks} labels={en.dashboard} locale="en" limit={2} />);

    expect(html).toContain("Task 0");
    expect(html).toContain("Task 1");
    expect(html).not.toContain("Task 2");
    expect(html).toContain(en.dashboard.more.replace("{n}", "1"));
  });
});

describe("builder layout", () => {
  it("places every node of the lead template", () => {
    for (const node of sampleLeadWorkflowDefinition.nodes) {
      expect(knownPositions[node.id], node.id).toBeDefined();
    }
  });

  it("labels branch edges and dashes the else edge", () => {
    expect(edgeStyle("leadScore > 80")).toMatchObject({ label: "leadScore > 80", style: { strokeDasharray: undefined } });
    expect(edgeStyle("else").style.strokeDasharray).toBe("6 4");
  });
});
