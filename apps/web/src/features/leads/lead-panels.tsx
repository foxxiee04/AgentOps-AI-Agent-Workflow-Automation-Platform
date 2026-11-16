"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { LeadSummaryView } from "@agentops/shared";
import { DURATION, DISTANCE, EASE_OUT, staggerDelay } from "../../components/motion";
import { StatusPill, type StatusPillTone } from "../../components/status-pill";
import type { Locale } from "../../lib/i18n";
import { SalesTaskList } from "./sales-task-list";
export { SalesTaskList } from "./sales-task-list";

type LeadLabels = {
  leads: string;
  noLeads: string;
  salesTasks: string;
  noTasks: string;
  score: string;
  category: string;
  summary: string;
  lead: string;
  due: string;
  more: string;
};

const DEFAULT_LIMIT = 10;

function moreLabel(more: string, hidden: number) {
  return more.replace("{n}", String(hidden));
}

const categoryTone: Record<string, StatusPillTone> = {
  "high-intent": "success",
  "low-intent": "neutral",
  spam: "danger"
};

/** Scored leads (newest first) with category, summary and a link to the run. */
export function LeadTable({
  leads,
  labels,
  locale,
  limit = DEFAULT_LIMIT
}: {
  leads: LeadSummaryView[];
  labels: LeadLabels;
  locale: Locale;
  limit?: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const visible = leads.slice(0, limit);
  const hidden = leads.length - visible.length;
  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-white">
      <div className="border-b border-[var(--hairline)] px-4 py-3">
        <h2 className="text-base font-bold text-[var(--ink)]">{labels.leads}</h2>
      </div>
      {leads.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--mute)]">{labels.noLeads}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-[var(--mute)]">
                <tr className="border-b border-[var(--hairline)]">
                  <th scope="col" className="px-3 py-3 font-medium">{labels.lead}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{labels.score}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{labels.category}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{labels.summary}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead, index) => (
                  <motion.tr
                    key={lead.workflowRunId}
                    initial={{ opacity: 0, y: reduce ? 0 : DISTANCE }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduce ? DURATION.reducedFade : DURATION.base,
                      ease: EASE_OUT,
                      delay: reduce ? 0 : staggerDelay(index)
                    }}
                    className="border-b border-[var(--hairline)] align-top transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-soft)]"
                  >
                    <td className="px-3 py-3">
                      <Link href={`/runs/${lead.workflowRunId}?lang=${locale}`} className="font-bold underline underline-offset-4">
                        {lead.name ?? lead.workflowRunId}
                      </Link>
                      <p className="text-xs text-[var(--mute)]">{[lead.company, lead.email].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-3 py-3 font-mono font-bold">{lead.leadScore}</td>
                    <td className="px-3 py-3">
                      <StatusPill tone={categoryTone[lead.category] ?? "neutral"}>{lead.category}</StatusPill>
                    </td>
                    <td className="px-3 py-3 text-[var(--body)]">{lead.summary ?? "-"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 ? (
            <p className="border-t border-[var(--hairline)] px-4 py-3 text-sm text-[var(--mute)]">+ {moreLabel(labels.more, hidden)}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

// SalesTaskList is implemented in ./sales-task-list and re-exported above.
