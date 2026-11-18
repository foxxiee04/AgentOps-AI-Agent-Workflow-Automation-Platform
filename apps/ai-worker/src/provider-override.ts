/**
 * Deployment-level AI provider override. Workflow definitions carry their own `modelProvider` (the seeded demo
 * workflow uses the deterministic `mock` provider so tests stay stable). In an environment that should call a real
 * model, set `AI_PROVIDER_OVERRIDE=openai` (and `OPENAI_API_KEY`): AI nodes configured with `mock` then run on OpenAI
 * with `AI_OPENAI_MODEL` (default gpt-4o-mini). Nodes that already name a real provider are left untouched, and nothing
 * changes when the variable is unset or the key is missing.
 */
export function applyProviderOverride<T extends Record<string, unknown>>(
  rawConfig: T,
  env: Record<string, string | undefined> = process.env
): T {
  if (env["AI_PROVIDER_OVERRIDE"]?.trim() !== "openai" || !env["OPENAI_API_KEY"]?.trim()) {
    return rawConfig;
  }
  const provider = rawConfig["modelProvider"] ?? "mock";
  if (provider !== "mock") {
    return rawConfig;
  }

  return {
    ...rawConfig,
    modelProvider: "openai",
    modelName: env["AI_OPENAI_MODEL"]?.trim() || "gpt-4o-mini"
  };
}
