"use client";

import { useState } from "react";
import { clientApiPost, type AiTestResult } from "../../lib/api";

const defaultInput = JSON.stringify(
  {
    leadName: "Anna",
    company: "Northstar Ops",
    message: "We urgently need sales automation and support workflow routing."
  },
  null,
  2
);

type AiConsoleLabels = {
  consoleTitle: string;
  inputJson: string;
  testAgent: string;
  testing: string;
  outputTitle: string;
  emptyOutput: string;
  valid: string;
  invalid: string;
};

const defaultLabels: AiConsoleLabels = {
  consoleTitle: "Test lead scoring agent",
  inputJson: "Input JSON",
  testAgent: "Test agent",
  testing: "Testing",
  outputTitle: "Structured output",
  emptyOutput: "Run a test to inspect schema-validated AI output.",
  valid: "valid",
  invalid: "invalid"
};

export function AiConsole({ labels = defaultLabels }: { labels?: Partial<AiConsoleLabels> }) {
  const copy = { ...defaultLabels, ...labels };
  const [input, setInput] = useState(defaultInput);
  const [result, setResult] = useState<AiTestResult | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function testAgent() {
    setIsLoading(true);
    setError(undefined);
    try {
      const parsedInput = JSON.parse(input) as Record<string, unknown>;
      const response = await clientApiPost<AiTestResult>("/ai/test-agent", {
        modelProvider: "mock",
        input: parsedInput
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI test failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[8px] border border-[var(--hairline)] bg-white">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--ink-deep)]">[+] {copy.consoleTitle}</h2>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-sm font-semibold text-[var(--mute)]" htmlFor="ai-input">
            {copy.inputJson}
          </label>
          <textarea
            id="ai-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-56 w-full rounded-[8px] border border-[var(--hairline)] bg-[#fbfcff] p-3 font-mono text-sm text-[var(--ink-deep)] outline-none focus:border-[var(--accent)] focus:bg-white"
          />
          <button
            type="button"
            onClick={testAgent}
            disabled={isLoading}
            className="min-h-9 rounded-[8px] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
          >
            {isLoading ? copy.testing : copy.testAgent}
          </button>
          {error ? <p className="rounded-[4px] border border-[#dc2626] bg-[#fff1f2] px-3 py-2 text-sm text-[#7f1d1d]">[!] {error}</p> : null}
        </div>
      </section>

      <section className="rounded-[8px] border border-[var(--hairline)] bg-white">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--ink-deep)]">[+] {copy.outputTitle}</h2>
        </div>
        <div className="p-4">
          {result ? (
            <div className="space-y-3">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p>[provider] {result.provider}</p>
                <p>[model] {result.modelName}</p>
                <p>[schema] {result.validation.schemaValid ? copy.valid : copy.invalid}</p>
              </div>
              <pre className="max-h-96 overflow-auto rounded-[4px] bg-[#f2eee9] p-3 text-xs leading-5 text-[#2f2a26]">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-[#5f5750]">[ ] {copy.emptyOutput}</p>
          )}
        </div>
      </section>
    </div>
  );
}
