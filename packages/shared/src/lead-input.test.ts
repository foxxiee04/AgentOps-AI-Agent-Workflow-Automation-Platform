import { describe, expect, it } from "vitest";
import { formatLeadInputErrors, leadInputSchema, requiresLeadInput } from "./lead-input";
import { sampleLeadWorkflowDefinition, type WorkflowDefinition } from "./workflow";

const validLead = {
  name: "Anna Nguyen",
  email: "anna@shopabc.vn",
  message: "We need to automate our chat support and order processing.",
  company: "Shop ABC",
  source: "website_form"
};

describe("leadInputSchema", () => {
  it("accepts a lead payload and keeps extra fields", () => {
    const result = leadInputSchema.safeParse({ ...validLead, budget: "5000000" });

    expect(result.success).toBe(true);
    expect(result.success && result.data).toMatchObject({ ...validLead, budget: "5000000" });
  });

  it("trims the text fields", () => {
    const result = leadInputSchema.safeParse({ ...validLead, name: "  Anna Nguyen  ", message: "  hello  " });

    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe("Anna Nguyen");
    expect(result.success && result.data.message).toBe("hello");
  });

  it("rejects a lead without an email", () => {
    const result = leadInputSchema.safeParse({ name: "Anna", message: "hello" });

    expect(result.success).toBe(false);
    expect(result.success === false && Object.keys(formatLeadInputErrors(result.error))).toEqual(["email"]);
  });

  it("rejects a malformed email", () => {
    const result = leadInputSchema.safeParse({ ...validLead, email: "anna.shopabc.vn" });

    expect(result.success).toBe(false);
    expect(result.success === false && formatLeadInputErrors(result.error).email).toBeTruthy();
  });

  it("rejects an empty message", () => {
    const result = leadInputSchema.safeParse({ ...validLead, message: "   " });

    expect(result.success).toBe(false);
    expect(result.success === false && formatLeadInputErrors(result.error).message).toBeTruthy();
  });

  it("rejects a non string name", () => {
    const result = leadInputSchema.safeParse({ ...validLead, name: 123 });

    expect(result.success).toBe(false);
    expect(result.success === false && formatLeadInputErrors(result.error).name).toBeTruthy();
  });

  it("reports the first message per field", () => {
    const result = leadInputSchema.safeParse({});

    expect(result.success).toBe(false);
    const details = result.success === false ? formatLeadInputErrors(result.error) : {};
    expect(Object.keys(details).sort()).toEqual(["email", "message", "name"]);
    expect(Object.values(details).every((message) => typeof message === "string" && message.length > 0)).toBe(true);
  });
});

describe("requiresLeadInput", () => {
  it("detects the lead template through its scoring prompt", () => {
    expect(requiresLeadInput(sampleLeadWorkflowDefinition)).toBe(true);
  });

  it("detects a trigger that declares the lead input schema", () => {
    const definition: WorkflowDefinition = {
      nodes: [{ id: "trigger-1", type: "TRIGGER", name: "Lead received", config: { inputSchema: "lead" } }],
      edges: []
    };

    expect(requiresLeadInput(definition)).toBe(true);
  });

  it("returns false for a workflow without the lead prompt", () => {
    const definition: WorkflowDefinition = {
      nodes: [
        { id: "trigger-1", type: "TRIGGER", name: "Manual", config: { triggerType: "manual" } },
        {
          id: "ai-1",
          type: "AI_AGENT",
          name: "Summarize",
          config: { systemPrompt: "You are a summarizer.", outputSchema: {} }
        }
      ],
      edges: []
    };

    expect(requiresLeadInput(definition)).toBe(false);
  });
});
