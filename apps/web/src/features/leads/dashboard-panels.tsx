"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DURATION,
  DISTANCE,
  EASE_OUT,
  LiveCursor,
  MaskHeading,
  staggerDelay,
  useIconHover
} from "../../components/motion";
import { StatusPill } from "../../components/status-pill";
import EyeIcon from "../../icons/eye-icon";
import RefreshIcon from "../../icons/refresh-icon";
import type { RecentActivity, WorkflowRunView } from "../../lib/api";
import type { Locale } from "../../lib/i18n";
import { runStatusTone } from "../../lib/status";

type DashboardRun = WorkflowRunView & { workflowName?: string };

const liveCopy: Record<Locale, string> = {
  vi: "trực tiếp",
  en: "live"
};

/** Page title (mask rise) plus the builder link whose icon animates on hover/focus. */
export function DashboardHeader({
  eyebrow,
  title,
  builderHref,
  builderLabel
}: {
  eyebrow: string;
  title: string;
  builderHref: string;
  builderLabel: string;
}) {
  const { ref: iconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-[var(--accent)]">{eyebrow}</p>
        <MaskHeading className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-[var(--ink-deep)] md:text-4xl">{title}</MaskHeading>
      </div>
      <Link
        href={builderHref}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white"
      >
        <EyeIcon ref={iconRef} size={16} strokeWidth={1.75} aria-hidden="true" />
        {builderLabel}
      </Link>
    </div>
  );
}

function ViewRunLink({ href, label }: { href: string; label: string }) {
  const { ref: iconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();

  return (
    <Link
      href={href}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink-deep)] underline decoration-[var(--hairline-strong)] underline-offset-4"
    >
      <EyeIcon ref={iconRef} size={16} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Recent runs table: rows fade/rise once, capped by the shared stagger token. */
export function RecentRunsTable({
  runs,
  title,
  detailsLabel,
  emptyLabel,
  locale
}: {
  runs: DashboardRun[];
  title: string;
  detailsLabel: string;
  emptyLabel: string;
  locale: Locale;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-white">
      <div className="border-b border-[var(--hairline)] px-4 py-3">
        <h2 className="text-base font-bold text-[var(--ink-deep)]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="text-xs uppercase text-[var(--mute)]">
            <tr className="border-b border-[var(--hairline)]">
              <th className="px-3 py-3 font-medium">Run</th>
              <th className="px-3 py-3 font-medium">Workflow</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Trigger</th>
              <th className="px-3 py-3 font-medium">{detailsLabel}</th>
            </tr>
          </thead>
          <tbody>
            {runs.length > 0 ? (
              runs.map((run, index) => (
                <motion.tr
                  key={run.id}
                  initial={{ opacity: 0, y: reduce ? 0 : DISTANCE }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduce ? DURATION.reducedFade : DURATION.base,
                    ease: EASE_OUT,
                    delay: reduce ? 0 : staggerDelay(index)
                  }}
                  className="border-b border-[var(--hairline)] transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-soft)]"
                >
                  <td className="px-3 py-3 font-medium">
                    <Link href={`/runs/${run.id}?lang=${locale}`} className="underline decoration-[var(--hairline-strong)] underline-offset-4">
                      {run.id}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{run.workflowName || run.workflowId}</td>
                  <td className="px-3 py-3">
                    <StatusPill tone={runStatusTone[run.status]}>{run.status}</StatusPill>
                  </td>
                  <td className="px-3 py-3">{run.triggerType}</td>
                  <td className="px-3 py-3">
                    <ViewRunLink href={`/runs/${run.id}?lang=${locale}`} label={detailsLabel} />
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-[var(--mute)]">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Event stream: new events slide in from above; the live cursor is the only loop. */
export function EventStream({
  events,
  title,
  emptyLabel,
  locale
}: {
  events: RecentActivity[];
  title: string;
  emptyLabel: string;
  locale: Locale;
}) {
  const reduce = useReducedMotion() ?? false;
  const { ref: iconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();
  const visible = events.slice(0, 6);

  return (
    <section className="rounded-xl border border-[var(--hairline)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] px-4 py-3">
        <h2 className="text-base font-bold text-[var(--ink-deep)]">{title}</h2>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--mute)]"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          <RefreshIcon ref={iconRef} size={16} strokeWidth={1.75} aria-hidden="true" />
          ● {liveCopy[locale]} <LiveCursor />
        </span>
      </div>
      <div className="divide-y divide-[var(--hairline)]">
        {visible.length > 0 ? (
          <AnimatePresence initial={false}>
            {visible.map((event) => (
              <motion.div
                key={event.eventId}
                initial={{ opacity: 0, y: reduce ? 0 : -DISTANCE }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduce ? DURATION.reducedFade : DURATION.base,
                  ease: EASE_OUT
                }}
                className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto]"
              >
                <span>{event.type}</span>
                <span className="font-mono text-[var(--mute)]">{event.eventId}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <p className="px-4 py-4 text-sm text-[var(--mute)]">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}
