"use client";

import type { WorkflowRunStepView, WorkflowStepStatus } from "@agentops/shared";
import { Stagger, StaggerItem, StatusFlash } from "../../components/motion";
import { formatDuration } from "../../lib/status";

export type TimelineLabels = {
  input: string;
  output: string;
  tokens: string;
  model: string;
  duration: string;
  error: string;
  retries: string;
  noData: string;
  statusMessages: Record<WorkflowStepStatus, string>;
};

/** Presentational step timeline: status, masked input, output, tokens, duration and error per node. */
export function StepTimeline({ steps, labels }: { steps: WorkflowRunStepView[]; labels: TimelineLabels }) {
  return (
    <div role="list" className="relative">
      <span aria-hidden="true" className="absolute left-[21px] top-2 bottom-2 w-px bg-[var(--hairline-strong)]" />
      <Stagger className="divide-y divide-[var(--hairline)]">
        {steps.map((step, index) => {
          const hasData = step.input !== undefined || step.output !== undefined;
          return (
            <StaggerItem
              key={step.id}
              role="listitem"
              className="relative grid gap-4 py-4 text-sm md:grid-cols-[44px_1fr] md:items-start"
              data-step={step.nodeId}
            >
              <div className="relative z-10 flex justify-center pt-1">
                <StatusFlash status={step.status}>
                  <StepMarker status={step.status} />
                </StatusFlash>
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--mute)]">[{String(index + 1).padStart(2, "0")}]</span>
                  <h3 className="font-bold text-[var(--ink)]">{step.nodeName}</h3>
                  <span className="font-mono text-xs text-[var(--mute)]">{step.nodeType}</span>
                </div>
                <p className="text-[var(--body)]">{step.errorMessage ?? labels.statusMessages[step.status]}</p>
                <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-[var(--mute)]">
                  {step.durationMs !== undefined ? <Fact label={labels.duration} value={formatDuration(step.durationMs) ?? ""} /> : null}
                  {step.tokenUsage ? (
                    <>
                      <Fact label={labels.model} value={step.tokenUsage.modelName} />
                      <Fact label={labels.tokens} value={`${step.tokenUsage.inputTokens} in / ${step.tokenUsage.outputTokens} out`} />
                    </>
                  ) : null}
                  {step.retryCount > 0 ? <Fact label={labels.retries} value={String(step.retryCount)} /> : null}
                </dl>
                {step.errorMessage ? (
                  <p className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger-ink)]">
                    ✕ {labels.error}: {step.errorMessage}
                  </p>
                ) : null}
                {hasData ? (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {step.input !== undefined ? <JsonBlock title={labels.input} value={step.input} /> : null}
                    {step.output !== undefined ? <JsonBlock title={labels.output} value={step.output} /> : null}
                  </div>
                ) : null}
                <p className="break-all font-mono text-xs text-[var(--mute)]">{step.nodeId}</p>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}

function StepMarker({ status }: { status: WorkflowStepStatus }) {
  if (status === "RUNNING") {
    return <span className="live-chip is-running">{status}</span>;
  }
  const color =
    status === "COMPLETED"
      ? "var(--success)"
      : status === "FAILED"
        ? "var(--danger)"
        : status === "WAITING_APPROVAL"
          ? "var(--warning)"
          : "var(--ash)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-mono text-[10.5px] uppercase tracking-wide text-[var(--mute)]">{status}</span>
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline">{label}: </dt>
      <dd className="inline text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="min-w-0 rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)]">
      <summary className="cursor-pointer px-3 py-2 font-mono text-xs font-bold text-[var(--ink)]">{title}</summary>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-[var(--hairline)] p-3 text-xs leading-5 text-[var(--charcoal)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
