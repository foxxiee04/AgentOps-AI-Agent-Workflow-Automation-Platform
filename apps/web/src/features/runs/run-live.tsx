"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { isRunActive, type WorkflowRunStepsView, type WorkflowRunView } from "@agentops/shared";
import type { ReactNode } from "react";
import { LiveCursor, MaskHeading, StatusFlash, useIconHover } from "../../components/motion";
import { StatusPill } from "../../components/status-pill";
import EyeIcon from "../../icons/eye-icon";
import RefreshIcon from "../../icons/refresh-icon";
import { fetchRun, fetchRunSteps } from "../../lib/api";
import type { Locale } from "../../lib/i18n";
import { runStatusTone } from "../../lib/status";
import { StepTimeline, type TimelineLabels } from "./step-timeline";

export const RUN_POLL_INTERVAL_MS = 4_000;

export type RunLiveLabels = TimelineLabels & {
  live: string;
  finished: string;
  runError: string;
  waitingApproval: string;
  goToApprovals: string;
  steps: string;
};

/** Run status + step timeline that polls every 4 s while the run can still change (SSE later). */
export function RunLive({
  runId,
  initialRun,
  initialSteps,
  labels,
  locale,
  poll = true
}: {
  runId: string;
  initialRun: WorkflowRunView;
  initialSteps: WorkflowRunStepsView;
  labels: RunLiveLabels;
  locale: Locale;
  poll?: boolean;
}) {
  const run = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetchRun(runId),
    initialData: initialRun,
    refetchInterval: (query) => (poll && isRunActive(query.state.data?.status ?? "") ? RUN_POLL_INTERVAL_MS : false)
  });
  const active = isRunActive(run.data.status);
  const steps = useQuery({
    queryKey: ["run-steps", runId],
    queryFn: () => fetchRunSteps(runId),
    initialData: initialSteps,
    refetchInterval: poll && active ? RUN_POLL_INTERVAL_MS : false
  });
  const { ref: refreshRef, ...refreshHandlers } = useIconHover();

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--ink)]">{labels.steps}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span
            {...refreshHandlers}
            className="inline-flex flex-wrap items-center gap-1.5 font-mono text-xs text-[var(--mute)]"
            aria-live="polite"
          >
            <span aria-hidden="true" inert className="inline-flex shrink-0">
              <RefreshIcon ref={refreshRef} size={16} strokeWidth={1.75} />
            </span>
            {active ? `● ${labels.live}` : `✓ ${labels.finished}`}
            {active ? <LiveCursor /> : null}
          </span>
           <StatusFlash status={run.data.status}>
             {run.data.status === "RUNNING" ? (
               <span className="live-chip is-running">{run.data.status}</span>
             ) : (
               <StatusPill tone={runStatusTone[run.data.status]}>{run.data.status}</StatusPill>
             )}
           </StatusFlash>
        </div>
      </div>
      {run.data.status === "WAITING_APPROVAL" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning-ink)]">
          <span>⚠ {labels.waitingApproval}</span>
          <Link href={`/approvals?lang=${locale}`} className="rounded-xl border border-[var(--warning)] px-3 py-1 font-bold">
            {labels.goToApprovals}
          </Link>
        </div>
      ) : null}
      {run.data.errorMessage ? (
        <p role="alert" className="border-b border-[var(--hairline)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-ink)]">
          ✕ {labels.runError}: {run.data.errorMessage}
        </p>
      ) : null}
      {steps.isError ? (
        <p role="alert" className="border-b border-[var(--hairline)] px-4 py-2 font-mono text-xs text-[var(--danger-ink)]">
          ✕ {steps.error instanceof Error ? steps.error.message : "refresh failed"}
        </p>
      ) : null}
      <StepTimeline steps={steps.data.steps} labels={labels} />
    </div>
  );
}

/** Page title for the run detail screen; keeps the mask reveal inside the client boundary. */
export function RunDetailHeading({ children }: { children: ReactNode }) {
  return (
    <MaskHeading className="font-display mt-1 break-all text-[34px] font-normal leading-[1.1] text-[var(--ink)]">
      {children}
    </MaskHeading>
  );
}

/** Header link with the eye icon; hovering or focusing the whole link starts the icon. */
export function RunHeaderLink({
  href,
  children,
  primary = false
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  const { ref, ...handlers } = useIconHover();

  return (
    <Link
      {...handlers}
      href={href}
      className={
        primary
          ? "inline-flex min-h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors duration-200"
          : "inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-white px-3 text-sm font-semibold text-[var(--ink)] transition-colors duration-200"
      }
    >
      <span aria-hidden="true" inert className="inline-flex shrink-0">
        <EyeIcon ref={ref} size={16} strokeWidth={1.75} />
      </span>
      {children}
    </Link>
  );
}
