import { describe, expect, it } from "vitest";
import { AiService } from "./ai.service";

describe("AiService", () => {
  it("returns prompt preview, schema validation, and token usage for test agent", () => {
    const service = new AiService();
    const result = service.testAgent({
      input: {
        lead: {
          name: "Anna",
          email: "anna@example.com",
          message: "We need urgent sales automation."
        }
      },
      config: {
        userPromptTemplate: "Lead {{name}} says {{message}}",
        inputMapping: {
          name: "lead.name",
          email: "lead.email",
          message: "lead.message"
        }
      }
    });

    expect(result.safeInput).toMatchObject({ email: "an***@example.com" });
    expect(result.promptPreview.user).toBe("Lead Anna says We need urgent sales automation.");
    expect(result.validation.schemaValid).toBe(true);
    expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
  });

  it("evaluates prompt cases and returns a pass rate", () => {
    const service = new AiService();
    const result = service.evaluateAgent({
      testCases: [
        {
          id: "urgent-lead",
          input: { message: "urgent sales automation" },
          expected: { category: "high-intent" }
        },
        {
          id: "general-lead",
          input: { message: "just browsing" },
          expected: { category: "high-intent" }
        }
      ]
    });

    expect(result.totalCases).toBe(2);
    expect(result.passed).toBe(1);
    expect(result.passRate).toBe(0.5);
  });
});
