export type LeadCategory = "high-intent" | "low-intent" | "spam";

export const leadCategories: LeadCategory[] = ["high-intent", "low-intent", "spam"];

export type EvaluatedCase = {
  caseId: string;
  expected: { category: string; branch?: "A" | "B" };
  output?: { category?: string; leadScore?: number };
  schemaValid: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type PerClassMetrics = {
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

export type EvaluationReport = {
  total: number;
  accuracy: number;
  macroF1: number;
  perClass: Record<LeadCategory, PerClassMetrics>;
  confusionMatrix: Record<LeadCategory, Record<LeadCategory | "error", number>>;
  branchAccuracy: number;
  hotLeadMissRate: number;
  schemaValidRate: number;
  errorRate: number;
  latencyMs: { p50: number; p95: number; max: number };
  tokens: { input: number; output: number };
  costUsd: { total: number; perLead: number };
};

const RATIO_DECIMALS = 4;
const COST_DECIMALS = 6;
const BRANCH_A_THRESHOLD = 80;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function ratio(value: number): number {
  return round(value, RATIO_DECIMALS);
}

function divideOrZero(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function isLeadCategory(value: unknown): value is LeadCategory {
  return value === "high-intent" || value === "low-intent" || value === "spam";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index] as number;
}

/**
 * Pure evaluation of a golden-set run. No I/O: every number is derived from the
 * supplied cases. Failed calls (`output === undefined`) count as incorrect.
 */
export function evaluateLeadClassification(cases: EvaluatedCase[]): EvaluationReport {
  const total = cases.length;

  const confusionMatrix = {} as Record<LeadCategory, Record<LeadCategory | "error", number>>;
  const truePositives = {} as Record<LeadCategory, number>;
  const falsePositives = {} as Record<LeadCategory, number>;
  const falseNegatives = {} as Record<LeadCategory, number>;
  for (const category of leadCategories) {
    confusionMatrix[category] = { "high-intent": 0, "low-intent": 0, spam: 0, error: 0 };
    truePositives[category] = 0;
    falsePositives[category] = 0;
    falseNegatives[category] = 0;
  }

  let correct = 0;
  let branchTotal = 0;
  let branchCorrect = 0;
  let expectedBranchA = 0;
  let missedBranchA = 0;
  let schemaValid = 0;
  let errors = 0;
  const latencies: number[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsdTotal = 0;

  for (const testCase of cases) {
    const expectedCategory = testCase.expected.category as LeadCategory;
    const predictedCategory = isLeadCategory(testCase.output?.category) ? testCase.output.category : undefined;

    if (predictedCategory === expectedCategory) {
      correct += 1;
    }

    if (predictedCategory) {
      confusionMatrix[expectedCategory][predictedCategory] += 1;
    } else {
      confusionMatrix[expectedCategory].error += 1;
    }

    for (const category of leadCategories) {
      if (predictedCategory === category && expectedCategory === category) {
        truePositives[category] += 1;
      } else if (predictedCategory === category && expectedCategory !== category) {
        falsePositives[category] += 1;
      } else if (predictedCategory !== category && expectedCategory === category) {
        falseNegatives[category] += 1;
      }
    }

    const leadScore = testCase.output?.leadScore;
    const predictedBranch: "A" | "B" = leadScore !== undefined && leadScore > BRANCH_A_THRESHOLD ? "A" : "B";
    if (testCase.expected.branch === "A" || testCase.expected.branch === "B") {
      branchTotal += 1;
      if (predictedBranch === testCase.expected.branch) {
        branchCorrect += 1;
      }
      if (testCase.expected.branch === "A") {
        expectedBranchA += 1;
        if (predictedBranch === "B") {
          missedBranchA += 1;
        }
      }
    }

    if (testCase.schemaValid) {
      schemaValid += 1;
    }
    if (testCase.output === undefined) {
      errors += 1;
    }

    latencies.push(testCase.latencyMs);
    inputTokens += testCase.inputTokens;
    outputTokens += testCase.outputTokens;
    costUsdTotal += testCase.costUsd;
  }

  const perClass = {} as Record<LeadCategory, PerClassMetrics>;
  let f1Sum = 0;
  for (const category of leadCategories) {
    const precision = ratio(divideOrZero(truePositives[category], truePositives[category] + falsePositives[category]));
    const recall = ratio(divideOrZero(truePositives[category], truePositives[category] + falseNegatives[category]));
    const f1 = ratio(divideOrZero(2 * precision * recall, precision + recall));
    const support = cases.filter((testCase) => testCase.expected.category === category).length;
    perClass[category] = { precision, recall, f1, support };
    f1Sum += f1;
  }

  const sortedLatencies = [...latencies].sort((a, b) => a - b);

  return {
    total,
    accuracy: ratio(divideOrZero(correct, total)),
    macroF1: ratio(divideOrZero(f1Sum, leadCategories.length)),
    perClass,
    confusionMatrix,
    branchAccuracy: ratio(divideOrZero(branchCorrect, branchTotal)),
    hotLeadMissRate: ratio(divideOrZero(missedBranchA, expectedBranchA)),
    schemaValidRate: ratio(divideOrZero(schemaValid, total)),
    errorRate: ratio(divideOrZero(errors, total)),
    latencyMs: {
      p50: percentile(sortedLatencies, 50),
      p95: percentile(sortedLatencies, 95),
      max: sortedLatencies.length > 0 ? (sortedLatencies[sortedLatencies.length - 1] as number) : 0
    },
    tokens: { input: inputTokens, output: outputTokens },
    costUsd: {
      total: round(costUsdTotal, COST_DECIMALS),
      perLead: round(divideOrZero(costUsdTotal, Math.max(total, 1)), COST_DECIMALS)
    }
  };
}

export function formatEvaluationMarkdown(
  report: EvaluationReport,
  meta: { provider: string; model: string; goldenSetVersion: string }
): string {
  const lines: string[] = [];

  lines.push("# Lead classification evaluation");
  lines.push("");
  lines.push(`Provider: ${meta.provider} | Model: ${meta.model} | Golden set: ${meta.goldenSetVersion}`);
  lines.push("");
  lines.push("## Metrics");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Accuracy | ${report.accuracy} |`);
  lines.push(`| Macro F1 | ${report.macroF1} |`);
  lines.push(`| Branch accuracy | ${report.branchAccuracy} |`);
  lines.push(`| Hot-lead miss rate | ${report.hotLeadMissRate} |`);
  lines.push(`| Schema-valid rate | ${report.schemaValidRate} |`);
  lines.push(`| Error rate | ${report.errorRate} |`);
  lines.push(`| Latency p50 (ms) | ${report.latencyMs.p50} |`);
  lines.push(`| Latency p95 (ms) | ${report.latencyMs.p95} |`);
  lines.push(`| Latency max (ms) | ${report.latencyMs.max} |`);
  lines.push(`| Tokens input | ${report.tokens.input} |`);
  lines.push(`| Tokens output | ${report.tokens.output} |`);
  lines.push(`| Cost total (USD) | ${report.costUsd.total} |`);
  lines.push(`| Cost per lead (USD) | ${report.costUsd.perLead} |`);
  lines.push("");
  lines.push("## Per-class metrics");
  lines.push("");
  lines.push("| Class | Precision | Recall | F1 | Support |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const category of leadCategories) {
    const metrics = report.perClass[category];
    lines.push(`| ${category} | ${metrics.precision} | ${metrics.recall} | ${metrics.f1} | ${metrics.support} |`);
  }
  lines.push("");
  lines.push("## Confusion matrix");
  lines.push("");
  lines.push("| expected \\ predicted | high-intent | low-intent | spam | error |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const expected of leadCategories) {
    const row = report.confusionMatrix[expected];
    lines.push(`| ${expected} | ${row["high-intent"]} | ${row["low-intent"]} | ${row.spam} | ${row.error} |`);
  }
  lines.push("");

  return lines.join("\n");
}
