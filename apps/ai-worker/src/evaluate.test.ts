import { describe, expect, it } from "vitest";
import { leadEvaluationCases } from "@agentops/shared";
import { runGoldenSet } from "./evaluate";

describe("runGoldenSet", () => {
  it("scores the golden set with the mock provider", async () => {
    const { report, markdown } = await runGoldenSet({ provider: "mock", model: "gpt-4o-mini" });

    expect(report.total).toBe(leadEvaluationCases.length);
    expect(report.accuracy).toBeGreaterThanOrEqual(0.9);
    expect(report.hotLeadMissRate).toBeLessThanOrEqual(0.1);
    expect(report.schemaValidRate).toBe(1);
    expect(report.costUsd.total).toBe(0);
    expect(markdown).toContain("Accuracy");
  });

  it("records every call as an error when the provider throws", async () => {
    const providerFactory = () => ({
      complete: async () => {
        throw new Error("provider unavailable");
      }
    });

    const { report } = await runGoldenSet({ provider: "mock", model: "gpt-4o-mini", providerFactory });

    expect(report.errorRate).toBe(1);
    expect(report.accuracy).toBe(0);
  });
});
