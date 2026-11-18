import { describe, expect, it } from "vitest";
import { applyProviderOverride } from "./provider-override";

const mockNode = { modelProvider: "mock", modelName: "mock-lead-scorer", temperature: 0 };

describe("applyProviderOverride", () => {
  it("leaves the config alone when the override is not set", () => {
    expect(applyProviderOverride(mockNode, { OPENAI_API_KEY: "sk-test" })).toBe(mockNode);
  });

  it("leaves the config alone when the OpenAI key is missing", () => {
    expect(applyProviderOverride(mockNode, { AI_PROVIDER_OVERRIDE: "openai" })).toBe(mockNode);
  });

  it("switches mock nodes to OpenAI with the default model", () => {
    expect(applyProviderOverride(mockNode, { AI_PROVIDER_OVERRIDE: "openai", OPENAI_API_KEY: "sk-test" })).toEqual({
      ...mockNode,
      modelProvider: "openai",
      modelName: "gpt-4o-mini"
    });
  });

  it("treats a missing provider as mock and honours AI_OPENAI_MODEL", () => {
    expect(
      applyProviderOverride({ temperature: 0 }, { AI_PROVIDER_OVERRIDE: "openai", OPENAI_API_KEY: "sk-test", AI_OPENAI_MODEL: "gpt-4.1-mini" })
    ).toEqual({ temperature: 0, modelProvider: "openai", modelName: "gpt-4.1-mini" });
  });

  it("does not touch nodes that already name a real provider", () => {
    const node = { modelProvider: "openai", modelName: "gpt-4o" };
    expect(applyProviderOverride(node, { AI_PROVIDER_OVERRIDE: "openai", OPENAI_API_KEY: "sk-test" })).toBe(node);
  });
});
