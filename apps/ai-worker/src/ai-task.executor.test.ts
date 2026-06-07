import { describe, expect, it } from "vitest";
import { executeAgentTask } from "./ai-task.executor";

describe("executeAgentTask", () => {
  it("masks mapped input and validates mock provider output", async () => {
    const result = await executeAgentTask({
      input: {
        lead: {
          name: "Anna",
          email: "anna@example.com",
          message: "We need urgent sales automation."
        }
      },
      config: {
        modelProvider: "mock",
        userPromptTemplate: "Analyze {{name}}: {{message}}",
        inputMapping: {
          name: "lead.name",
          email: "lead.email",
          message: "lead.message"
        },
        savePromptAndOutput: true
      }
    });

    expect(result.output).toMatchObject({ leadScore: 87, confidence: 0.91 });
    expect(result.prompt?.variables.email).toBe("an***@example.com");
    expect(result.validation.schemaValid).toBe(true);
    expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
  });

  it("fails clearly when OpenAI is requested without an API key", async () => {
    await expect(
      executeAgentTask({
        input: { message: "test" },
        config: { modelProvider: "openai", modelName: "gpt-4o-mini" }
      })
    ).rejects.toThrow("OPENAI_API_KEY is required");
  });
});
