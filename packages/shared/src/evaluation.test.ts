import { describe, expect, it } from "vitest";
import { leadEvaluationCases, leadGoldenSetVersion } from "./lead-eval-dataset";
import {
  evaluateLeadClassification,
  formatEvaluationMarkdown,
  type EvaluatedCase
} from "./evaluation";

const handComputedCases: EvaluatedCase[] = [
  {
    caseId: "c1",
    expected: { category: "high-intent", branch: "A" },
    output: { category: "high-intent", leadScore: 90 },
    schemaValid: true,
    latencyMs: 100,
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.001
  },
  {
    caseId: "c2",
    expected: { category: "high-intent", branch: "A" },
    output: { category: "high-intent", leadScore: 85 },
    schemaValid: true,
    latencyMs: 200,
    inputTokens: 200,
    outputTokens: 100,
    costUsd: 0.002
  },
  {
    caseId: "c3",
    expected: { category: "low-intent", branch: "B" },
    output: { category: "low-intent", leadScore: 20 },
    schemaValid: true,
    latencyMs: 300,
    inputTokens: 150,
    outputTokens: 60,
    costUsd: 0.001
  },
  {
    caseId: "c4",
    expected: { category: "low-intent", branch: "B" },
    output: { category: "low-intent", leadScore: 85 },
    schemaValid: true,
    latencyMs: 400,
    inputTokens: 120,
    outputTokens: 40,
    costUsd: 0.0005
  },
  {
    caseId: "c5",
    expected: { category: "spam", branch: "B" },
    output: { category: "spam", leadScore: 10 },
    schemaValid: true,
    latencyMs: 500,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0.0015
  },
  {
    caseId: "c6",
    expected: { category: "high-intent", branch: "A" },
    output: undefined,
    schemaValid: false,
    latencyMs: 600,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0
  }
];

describe("evaluateLeadClassification", () => {
  const report = evaluateLeadClassification(handComputedCases);

  it("computes accuracy, macro F1, and error rates", () => {
    expect(report.total).toBe(6);
    expect(report.accuracy).toBe(0.8333);
    expect(report.macroF1).toBe(0.9333);
    expect(report.schemaValidRate).toBe(0.8333);
    expect(report.errorRate).toBe(0.1667);
  });

  it("computes per-class precision, recall, f1 and support", () => {
    expect(report.perClass["high-intent"]).toEqual({ precision: 1, recall: 0.6667, f1: 0.8, support: 3 });
    expect(report.perClass["low-intent"]).toEqual({ precision: 1, recall: 1, f1: 1, support: 2 });
    expect(report.perClass.spam).toEqual({ precision: 1, recall: 1, f1: 1, support: 1 });
  });

  it("builds the confusion matrix with an error column", () => {
    expect(report.confusionMatrix["high-intent"]).toEqual({ "high-intent": 2, "low-intent": 0, spam: 0, error: 1 });
    expect(report.confusionMatrix["low-intent"]).toEqual({ "high-intent": 0, "low-intent": 2, spam: 0, error: 0 });
    expect(report.confusionMatrix.spam).toEqual({ "high-intent": 0, "low-intent": 0, spam: 1, error: 0 });
  });

  it("computes branch accuracy and hot-lead miss rate", () => {
    expect(report.branchAccuracy).toBe(0.6667);
    expect(report.hotLeadMissRate).toBe(0.3333);
  });

  it("computes nearest-rank latency percentiles", () => {
    expect(report.latencyMs).toEqual({ p50: 300, p95: 600, max: 600 });
  });

  it("aggregates tokens and cost", () => {
    expect(report.tokens).toEqual({ input: 570, output: 250 });
    expect(report.costUsd.total).toBe(0.006);
    expect(report.costUsd.perLead).toBe(0.001);
  });
});

describe("golden set", () => {
  it("has at least 40 unique cases with valid labels and branches", () => {
    expect(leadEvaluationCases.length).toBeGreaterThanOrEqual(40);

    const ids = leadEvaluationCases.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const testCase of leadEvaluationCases) {
      const category = testCase.expected.category as string;
      const branch = testCase.expected.branch as string;
      expect(["high-intent", "low-intent", "spam"]).toContain(category);
      expect(branch).toBe(category === "high-intent" ? "A" : "B");
    }
  });
});

describe("formatEvaluationMarkdown", () => {
  it("renders the metrics table and confusion matrix header", () => {
    const markdown = formatEvaluationMarkdown(evaluateLeadClassification(handComputedCases), {
      provider: "mock",
      model: "mock-lead-scorer",
      goldenSetVersion: leadGoldenSetVersion
    });

    expect(markdown).toContain("Accuracy");
    expect(markdown).toContain("expected \\ predicted");
  });
});
