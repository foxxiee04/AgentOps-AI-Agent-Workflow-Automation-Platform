"use client";

import { motion } from "motion/react";
import { landingCopy, type Locale } from "../../lib/i18n";
import { CountUp, EASE_OUT } from "../motion";

/**
 * The floating "workflow object": 4 stacked glass node cards connected by a
 * thin moss line, the AI card carrying the live chip and score count-up.
 * The whole object floats (ambient, 7s, ±8px) over a slow mist drift (24s);
 * both loops are transform/opacity only and disabled for reduced motion.
 */
export function WorkflowObject({ locale }: { locale: Locale }) {
  const t = landingCopy[locale].moss;

  return (
    <div className="relative">
      <motion.div
        aria-hidden="true"
        className="absolute -inset-x-12 -inset-y-8 -z-10 rounded-[50%]"
        style={{
          background:
            "radial-gradient(24rem 14rem at 70% 20%, rgba(198,243,92,0.16), transparent 65%), radial-gradient(26rem 16rem at 20% 90%, rgba(47,93,58,0.12), transparent 60%)",
          filter: "blur(28px)"
        }}
        animate={{ opacity: [0.55, 0.95, 0.55], scale: [1, 1.05, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <ol className="grid max-w-[380px]">
          {t.nodes.map((node, index) => (
            <li key={node.type}>
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="mx-auto block h-5 w-px bg-[var(--accent)] opacity-50"
                />
              ) : null}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + index * 0.08, duration: 0.5, ease: EASE_OUT }}
                className="glass flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.6)] px-4 py-3 shadow-[var(--shadow-md)]"
              >
                <span className="mono-label w-20 shrink-0 text-[10px]">+ {node.type}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-5 text-[var(--ink)]">
                    {node.title}
                  </span>
                  <span className="mono-label block truncate text-[10px] normal-case tracking-[0.08em]">
                    {node.meta}
                  </span>
                </span>
                {index === 1 ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="live-chip is-running">{t.runningLabel}</span>
                    <span className="text-right">
                      <span className="block font-display text-xl leading-none text-[var(--ink)]">
                        <CountUp value={87} aria-label={t.scoreLabel} />
                      </span>
                      <span className="mono-label block text-[9px]">/100</span>
                    </span>
                  </span>
                ) : null}
                {index === 3 ? (
                  <span className="status-pill is-success shrink-0">✓</span>
                ) : null}
                {index === 2 ? (
                  <span className="status-pill is-warning shrink-0">1</span>
                ) : null}
              </motion.div>
            </li>
          ))}
        </ol>
      </motion.div>
    </div>
  );
}
