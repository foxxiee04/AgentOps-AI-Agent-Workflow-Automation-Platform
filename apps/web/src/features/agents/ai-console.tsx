"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";
import { Reveal, Stagger, StaggerItem, StatusFlash, useIconHover } from "../../components/motion";
import SparklesIcon from "../../icons/sparkles-icon";
import { clientApiPost, type AiTestResult } from "../../lib/api";

/**
 * Client-side stagger wrapper so server pages can animate rows on first mount.
 * Children keep their keys and DOM position inside the staggered wrappers.
 */
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Stagger className={className}>
      {Children.map(children, (child, index) => (
        <StaggerItem key={isValidElement(child) && child.key != null ? child.key : index}>{child}</StaggerItem>
      ))}
    </Stagger>
  );
}

/** Client boundary for `StatusFlash` so server pages can keep their status tags. */
export function FlashStatus({ status, children }: { status: string; children: ReactNode }) {
  return <StatusFlash status={status}>{children}</StatusFlash>;
}

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
  const { ref: testIconRef, ...testIconHandlers } = useIconHover();

  async function testAgent() {
    setIsLoading(true);
    setResult(undefined);
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
      <section className="card">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">{copy.consoleTitle}</h2>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-sm font-semibold text-[var(--mute)]" htmlFor="ai-input">
            {copy.inputJson}
          </label>
          <textarea
            id="ai-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-56 w-full rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-soft)] p-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-card)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <button
            type="button"
            {...testIconHandlers}
            onClick={testAgent}
            disabled={isLoading}
            className="btn btn-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
          >
            <span aria-hidden="true" className="inline-flex shrink-0">
              <SparklesIcon ref={testIconRef} size={16} strokeWidth={1.75} />
            </span>
            {isLoading ? copy.testing : copy.testAgent}
          </button>
          {error ? <p className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-ink)]">⚠ {error}</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">{copy.outputTitle}</h2>
        </div>
        <div className="p-4">
          {result ? (
            <Reveal>
              <div className="space-y-3">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p>[provider] {result.provider}</p>
                  <p>[model] {result.modelName}</p>
                  <p>[schema] {result.validation.schemaValid ? copy.valid : copy.invalid}</p>
                </div>
                 <pre className="max-h-96 overflow-auto rounded-[var(--radius-control)] bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--body)]">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            </Reveal>
          ) : (
            <p className="text-sm text-[var(--mute)]">{copy.emptyOutput}</p>
          )}
        </div>
      </section>
    </div>
  );
}
