"use client";

import { motion } from "motion/react";
import { appCopy, landingCopy, type Locale } from "../../lib/i18n";
import { EASE_OUT } from "../motion";

const bars = [42, 55, 38, 61, 47, 70, 58, 82, 66, 90, 74, 100];

const previewRows = [
  { lead: "Hoàng Minh", score: 92, category: "hot", status: "completed" as const },
  { lead: "Thu Hà", score: 74, category: "warm", status: "waiting" as const },
  { lead: "Quốc Bảo", score: 88, category: "hot", status: "completed" as const },
  { lead: "Lan Chi", score: 63, category: "warm", status: "running" as const }
];

const statusPill: Record<string, string> = {
  completed: "status-pill is-success",
  waiting: "status-pill is-warning",
  running: "live-chip is-running"
};

/**
 * Screenshot-like composed dashboard: sidebar, KPI cards, a div-built bar
 * chart and a lead table, all real markup with static data. Scale-in
 * 1.04 -> 1 on first view (opacity only under reduced motion).
 */
export function DashboardPreview({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const m = t.moss;
  const shellNav = appCopy[locale].shell.nav;
  const navItems = [shellNav.dashboard, shellNav.runs, shellNav.approvals, shellNav.agents, shellNav.settings];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.04 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.9, ease: EASE_OUT }}
      className="glass overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-md)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-3">
        <span aria-hidden="true" className="crosshair h-3 w-3 shrink-0" />
        <span className="mono-label normal-case tracking-[0.08em]">app.agentops.dev/dashboard</span>
        <span className="live-chip is-running ml-auto">{t.moss.runningLabel}</span>
      </div>

      <div className="grid lg:grid-cols-[236px_1fr]">
        <aside className="hidden flex-col gap-1 border-r border-[var(--hairline)] bg-[var(--surface-soft)]/50 p-4 lg:flex">
          <p className="font-display px-2 pb-3 text-[17px] text-[var(--ink)]">AgentOps</p>
          {navItems.map((item, index) => (
            <span
              key={item}
              className={`rounded-[var(--radius-control)] px-2.5 py-1.5 text-[13px] font-medium ${
                index === 0
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--body)]"
              }`}
            >
              {item}
            </span>
          ))}
          <span className="mt-auto px-2 font-mono text-[10px] tracking-[0.1em] text-[var(--mute)]">
            ws · agentops-demo
          </span>
        </aside>

        <div className="min-w-0 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {m.previewKpis.map(([value, label, delta]) => (
              <div key={label} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
                <p className="mono-label text-[10px]">{label}</p>
                <p className="font-display mt-1 text-[26px] leading-tight text-[var(--ink)]">{value}</p>
                <p
                  className={`mt-0.5 font-mono text-[10px] tracking-[0.08em] ${
                    delta === "live" ? "text-[var(--accent)]" : "text-[var(--mute)]"
                  }`}
                >
                  {delta}
                </p>
              </div>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-baseline justify-between">
              <span className="mono-label text-[10px]">runs / day</span>
              <span className="font-mono text-[10px] text-[var(--mute)]">max 100</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-1.5">
              {bars.map((height, index) => (
                <div
                  key={index}
                  className={`flex-1 rounded-t-[3px] ${
                    index === bars.length - 1 ? "bg-[var(--live)]" : "bg-[var(--accent)]/75"
                  }`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {m.previewHead.map((head, index) => (
                    <th key={head} className={`px-4 py-2.5 ${index === 1 ? "text-right" : ""}`}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.lead} className="border-t border-[var(--hairline)] transition-colors hover:bg-[var(--surface-soft)]">
                    <td className="px-4 py-3 text-[13px] font-medium text-[var(--ink)]">{row.lead}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-[var(--ink)]">{row.score}</td>
                    <td className="px-4 py-3">
                      <span className="status-pill">{row.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusPill[row.status]}>{m.statuses[row.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
