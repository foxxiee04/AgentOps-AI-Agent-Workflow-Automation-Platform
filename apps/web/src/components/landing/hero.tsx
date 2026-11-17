"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { landingCopy, type Locale } from "../../lib/i18n";
import { MaskHeading, Reveal } from "../motion";
import { WorkflowObject } from "./workflow-object";

/** Serif headline with exactly one italicised emphasised word. */
function Headline({ text, italic }: { text: string; italic: string }) {
  const index = italic ? text.indexOf(italic) : -1;
  if (index < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, index)}
      <em className="font-display italic">{italic}</em>
      {text.slice(index + italic.length)}
    </>
  );
}

export function Hero({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const m = t.moss;
  const reduce = useReducedMotion() ?? false;
  const dashboardHref = `/dashboard?lang=${locale}`;
  const appHref = `/login?lang=${locale}&next=${encodeURIComponent(dashboardHref)}`;
  const builderHref = `/workflows/wf_lead_qualification/builder?lang=${locale}`;

  return (
    <section className="hairline-grid relative mx-auto max-w-[1240px] px-4 pb-20 pt-14 sm:px-6 lg:pb-32 lg:pt-24">
      <span aria-hidden="true" className="crosshair absolute left-6 top-24 z-10 hidden h-0 w-0 lg:block" />
      <span aria-hidden="true" className="crosshair absolute right-6 top-24 z-10 hidden h-0 w-0 lg:block" />
      <span aria-hidden="true" className="crosshair absolute bottom-24 left-6 z-10 hidden h-0 w-0 lg:block" />

      <div className="grid items-center gap-14 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <Reveal>
            <p className="eyebrow">
              <span aria-hidden="true" className="text-[var(--accent)]">+</span>
              {m.heroEyebrow}
            </p>
          </Reveal>
          <MaskHeading
            className="font-display mt-6 max-w-[14ch] text-[clamp(48px,7vw,104px)] font-normal leading-[1.02] tracking-[-0.025em] text-[var(--ink)] [&>span>span]:pb-[0.12em]"
            as="h1"
          >
            <Headline text={t.headline} italic={m.heroItalic} />
          </MaskHeading>
          <Reveal delay={0.3}>
            <p className="mt-6 max-w-[65ch] text-[17px] leading-[1.6] text-[var(--body)]">{t.subheadline}</p>
          </Reveal>
          <Reveal delay={0.4}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={appHref} className="btn btn-primary min-h-12 px-6 text-[15px]">
                {t.primaryCta}
              </Link>
              <Link href={builderHref} className="btn btn-secondary min-h-12 px-6 text-[15px]">
                {t.secondaryCta}
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="relative lg:col-span-5">
          <div
            aria-hidden="true"
            className="hairline-grid absolute -inset-8 hidden rounded-[var(--radius-card)] lg:block"
          />
          <span
            aria-hidden="true"
            className="crosshair absolute -left-4 top-0 z-10 hidden h-0 w-0 lg:block"
          />
          <span
            aria-hidden="true"
            className="crosshair absolute -right-4 bottom-0 z-10 hidden h-0 w-0 lg:block"
          />
          <motion.div
            className="mx-auto max-w-[340px] lg:max-w-none"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <WorkflowObject locale={locale} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
