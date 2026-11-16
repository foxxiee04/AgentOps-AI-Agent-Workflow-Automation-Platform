import { describe, expect, it } from "vitest";
import {
  evaluateEdgeCondition,
  hasRejectedPath,
  sampleLeadWorkflowDefinition,
  selectOutgoingEdges,
  selectRejectedEdges,
  validateWorkflowDefinition
} from "./workflow";

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

  it("accepts the reserved rejected condition on a HUMAN_APPROVAL node", () => {
    const issues = validateWorkflowDefinition(sampleLeadWorkflowDefinition);

    expect(issues).toEqual([]);
    expect(hasRejectedPath(sampleLeadWorkflowDefinition, "approval-1")).toBe(true);
  });

  it("reports the reserved rejected condition on any other node", () => {
    const issues = validateWorkflowDefinition({
      nodes: [
        { id: "trigger", type: "TRIGGER", name: "Trigger", config: {} },
        { id: "email", type: "EMAIL_MOCK", name: "Send email", config: {} },
        { id: "end", type: "END", name: "End", config: {} }
      ],
      edges: [
        { id: "e1", source: "trigger", target: "email" },
        { id: "e2", source: "email", target: "end", condition: "rejected" }
      ]
    });

    expect(issues.map((issue) => issue.code)).toContain("REJECTED_EDGE_INVALID_SOURCE");
    expect(issues.find((issue) => issue.code === "REJECTED_EDGE_INVALID_SOURCE")?.edgeId).toBe("e2");
  });
});


describe("edge conditions", () => {
  it("compares numbers and strings", () => {
    expect(evaluateEdgeCondition("leadScore > 80", { leadScore: 87 })).toBe(true);
    expect(evaluateEdgeCondition("leadScore > 80", { leadScore: 80 })).toBe(false);
    expect(evaluateEdgeCondition("leadScore <= 80", { leadScore: 80 })).toBe(true);
    expect(evaluateEdgeCondition("category == spam", { category: "spam" })).toBe(true);
    expect(evaluateEdgeCondition('category != "spam"', { category: "spam" })).toBe(false);
    expect(evaluateEdgeCondition("lead.score >= 10", { lead: { score: 10 } })).toBe(true);
  });

  it("treats missing, empty and unparseable conditions safely", () => {
    expect(evaluateEdgeCondition(undefined, {})).toBe(true);
    expect(evaluateEdgeCondition("true", {})).toBe(true);
    expect(evaluateEdgeCondition("leadScore > 80", {})).toBe(false);
    expect(evaluateEdgeCondition("garbage here", { a: 1 })).toBe(false);
  });

  it("uses else edges only when nothing else matched", () => {
    const edges = [
      { id: "a", source: "c", target: "hot", condition: "leadScore > 80" },
      { id: "b", source: "c", target: "end", condition: "else" }
    ];
    expect(selectOutgoingEdges(edges, { leadScore: 90 }).map((edge) => edge.id)).toEqual(["a"]);
    expect(selectOutgoingEdges(edges, { leadScore: 80 }).map((edge) => edge.id)).toEqual(["b"]);
  });
});

describe("the reserved rejected condition", () => {
  it("follows the rejected edge only when the approval was rejected", () => {
    expect(evaluateEdgeCondition("rejected", { approvalDecision: "rejected" })).toBe(true);
    expect(evaluateEdgeCondition("rejected", { approvalDecision: "approved" })).toBe(false);
    expect(evaluateEdgeCondition("rejected", {})).toBe(false);
  });

  it("is never followed on an approved decision", () => {
    const edges = [
      { id: "approve", source: "approval-1", target: "email-1" },
      { id: "reject", source: "approval-1", target: "notify-1", condition: "rejected" }
    ];

    expect(selectOutgoingEdges(edges, { approvalDecision: "approved" }).map((edge) => edge.id)).toEqual(["approve"]);
    expect(selectRejectedEdges(edges).map((edge) => edge.id)).toEqual(["reject"]);
  });
});
