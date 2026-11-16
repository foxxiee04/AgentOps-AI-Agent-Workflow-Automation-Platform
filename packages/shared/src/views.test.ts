import { describe, expect, it } from "vitest";
import { humanApprovalViewSchema, isRunActive, workflowRunStepViewSchema } from "./views";

describe("shared view schemas", () => {
  it("polls only runs that can still change", () => {
    expect(["PENDING", "RUNNING", "WAITING_APPROVAL"].every(isRunActive)).toBe(true);
    expect(["COMPLETED", "FAILED", "CANCELLED"].some(isRunActive)).toBe(false);
  });

  it("tolerates a malformed review payload instead of breaking the approval screen", () => {
    const approval = humanApprovalViewSchema.parse({
      id: "apr_1",
      workspaceId: "ws_demo",
      workflowRunId: "run_1",
      nodeId: "approval-1",
      stepId: "run_1_approval-1",
      status: "WAITING_APPROVAL",
      review: "not-an-object",
      requestedAt: "2026-10-18T00:00:00.000Z"
    });

    expect(approval.review).toEqual({ lead: {}, assessment: {}, email: {} });
  });

  it("defaults retryCount and rejects unknown step statuses", () => {
    const base = { id: "s", workflowRunId: "r", nodeId: "n", nodeName: "N", nodeType: "END", message: "m" };
    expect(workflowRunStepViewSchema.parse({ ...base, status: "COMPLETED" }).retryCount).toBe(0);
    expect(() => workflowRunStepViewSchema.parse({ ...base, status: "DONE" })).toThrow();
  });
});
