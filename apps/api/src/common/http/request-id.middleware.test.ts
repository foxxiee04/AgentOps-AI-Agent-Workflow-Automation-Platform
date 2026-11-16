import { describe, expect, it } from "vitest";
import { normalizeSpanPath } from "./request-id.middleware";

describe("normalizeSpanPath", () => {
  it("replaces run, workflow and version ids so span names stay low-cardinality", () => {
    expect(normalizeSpanPath("/workflow-runs/run_1fb6aba7-b19a-491f-b675-47633101cbfc/steps/approval-1/approval")).toBe(
      "/workflow-runs/:runId/steps/approval-1/approval"
    );
    expect(normalizeSpanPath("/workflows/wf_lead_qualification/run")).toBe("/workflows/:workflowId/run");
    expect(normalizeSpanPath("/dashboard/leads")).toBe("/dashboard/leads");
  });
});
