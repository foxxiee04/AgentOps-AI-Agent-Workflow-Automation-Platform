import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai.service";

describe("AiService", () => {
  it("returns prompt preview, schema validation, and persisted token usage for test agent", async () => {
    const usageRecords: Array<{ workspaceId: string; aiTokensUsed: number; workflowStepsExecuted: number; createdAt: Date }> = [];
    const service = new AiService(
      {
        client: {
          usageRecord: {
            create: vi.fn(async ({ data }) => {
              usageRecords.push({ ...data, createdAt: new Date() });
              return usageRecords.at(-1);
            }),
            findMany: vi.fn(async () => usageRecords)
          }
        }
      } as never,
      { ensureDemoWorkspace: vi.fn(async () => undefined) } as never
    );

    const result = await service.testAgent({
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
    expect(usageRecords).toHaveLength(1);

    const usage = await service.usage();
    expect(usage.aiCallsToday).toBe(1);
    expect(usage.tokensUsedToday).toBe(result.tokenUsage.inputTokens + result.tokenUsage.outputTokens);
  });

  it("evaluates prompt cases and returns a pass rate", async () => {
    const service = new AiService({} as never, { ensureDemoWorkspace: vi.fn(async () => undefined) } as never);
    const result = await service.evaluateAgent({
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
