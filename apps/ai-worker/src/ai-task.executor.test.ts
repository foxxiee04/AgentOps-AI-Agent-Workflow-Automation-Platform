import { describe, expect, it } from "vitest";
import {
  defaultLeadEmailOutputSchema,
  leadEvaluationCases,
  leadScoringSystemPrompt,
  leadScoringUserPromptTemplate
} from "@agentops/shared";
import { executeAgentTask, type AiCompletionResponse, type AiProviderClient } from "./ai-task.executor";

const validScore = {
  leadScore: 90,
  category: "high-intent",
  summary: "ok",
  recommendedAction: "call",
  confidence: 0.9
};
const usage = { inputTokens: 10, outputTokens: 5 };

function fakeProvider(responses: Array<() => AiCompletionResponse>) {
  let calls = 0;
  const provider: AiProviderClient = {
    async complete() {
      const next = responses[Math.min(calls, responses.length - 1)]!;
      calls += 1;
      return next();
    }
  };
  return { provider, calls: () => calls };
}

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

  it("retries after an invalid output and sums token usage", async () => {
    const fake = fakeProvider([
      () => ({ output: { leadScore: 150 }, tokenUsage: usage }),
      () => ({ output: validScore, tokenUsage: usage })
    ]);
    const result = await executeAgentTask(
      { input: { message: "hello there" }, config: { modelProvider: "mock", retryLimit: 1 } },
      () => fake.provider
    );
    expect(result.attempts).toBe(2);
    expect(result.tokenUsage).toEqual({ inputTokens: 20, outputTokens: 10 });
  });

  it("fails after retries are exhausted", async () => {
    const fake = fakeProvider([() => ({ output: { leadScore: 150 }, tokenUsage: usage })]);
    await expect(
      executeAgentTask(
        { input: { message: "hello there" }, config: { modelProvider: "mock", retryLimit: 2 } },
        () => fake.provider
      )
    ).rejects.toThrow("after 3 attempt(s)");
    expect(fake.calls()).toBe(3);
  });

  it("produces subject and body for the email schema", async () => {
    const result = await executeAgentTask({
      input: { name: "Anna", company: "Shop ABC" },
      config: {
        modelProvider: "mock",
        userPromptTemplate: "{{name}} {{company}}",
        outputSchema: defaultLeadEmailOutputSchema
      }
    });
    expect(result.output["subject"]).toContain("Shop ABC");
    expect(result.output["body"]).toContain("Anna");
  });

  it("classifies at least 90% of the labeled lead dataset", async () => {
    let correct = 0;
    for (const testCase of leadEvaluationCases) {
      const result = await executeAgentTask({
        input: testCase.input,
        config: {
          modelProvider: "mock",
          systemPrompt: leadScoringSystemPrompt,
          userPromptTemplate: leadScoringUserPromptTemplate
        }
      });
      if (result.output["category"] === testCase.expected["category"]) {
        correct += 1;
      }
    }
    expect(correct / leadEvaluationCases.length).toBeGreaterThanOrEqual(0.9);
  });
});
