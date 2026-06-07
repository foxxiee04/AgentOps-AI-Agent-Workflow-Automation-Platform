import { describe, expect, it } from "vitest";
import {
  aiAgentNodeConfigSchema,
  buildAiPrompt,
  defaultLeadScoringOutputSchema,
  evaluateAiOutput,
  maskSensitivePromptInput,
  validateAiOutput
} from "./ai";

describe("AI platform helpers", () => {
  it("masks emails, phone numbers, and secret-like keys", () => {
    expect(
      maskSensitivePromptInput({
        email: "anna@example.com",
        phone: "+1 555 222 1111",
        apiKey: "sk-secret",
        nested: { refreshToken: "token-value" }
      })
    ).toEqual({
      email: "an***@example.com",
      phone: "[PHONE_REDACTED]",
      apiKey: "[REDACTED]",
      nested: { refreshToken: "[REDACTED]" }
    });
  });

  it("renders prompts from mapped input", () => {
    const config = aiAgentNodeConfigSchema.parse({
      userPromptTemplate: "Lead {{leadName}} from {{company}} says: {{message}}",
      inputMapping: {
        leadName: "lead.name",
        company: "lead.company",
        message: "lead.message"
      }
    });

    expect(
      buildAiPrompt(config, {
        lead: {
          name: "Anna",
          company: "ScaleUp AI",
          message: "We need sales automation."
        }
      }).user
    ).toBe("Lead Anna from ScaleUp AI says: We need sales automation.");
  });

  it("validates output against JSON Schema", () => {
    const validation = validateAiOutput(defaultLeadScoringOutputSchema, {
      leadScore: 92,
      category: "high-intent",
      summary: "Interested in automation.",
      recommendedAction: "Send follow up.",
      personalizedEmail: "Hi Anna...",
      confidence: 0.91
    });

    expect(validation.valid).toBe(true);
  });

  it("returns evaluation mismatches", () => {
    expect(evaluateAiOutput({ category: "low-intent" }, { category: "high-intent" })).toEqual([
      'category: expected "high-intent", received "low-intent"'
    ]);
  });
});
