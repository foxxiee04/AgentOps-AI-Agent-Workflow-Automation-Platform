import { describe, expect, it } from "vitest";
import { sampleLeadWorkflowDefinition, validateWorkflowDefinition } from "./workflow";

describe("validateWorkflowDefinition", () => {
  it("accepts the sample lead workflow", () => {
    expect(validateWorkflowDefinition(sampleLeadWorkflowDefinition)).toEqual([]);
  });

  it("detects missing trigger and unreachable nodes", () => {
    const issues = validateWorkflowDefinition({
      nodes: [{ id: "end", type: "END", name: "End", config: {} }],
      edges: []
    });

    expect(issues.map((issue) => issue.code)).toContain("MISSING_TRIGGER");
    expect(issues.map((issue) => issue.code)).toContain("UNREACHABLE_NODE");
  });
});

