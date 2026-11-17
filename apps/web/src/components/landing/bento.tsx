"use client";

import Link from "next/link";
import { landingCopy, type Locale } from "../../lib/i18n";
import { Spotlight, Stagger, StaggerItem, TiltCard, useIconHover } from "../motion";
import BrainCircuitIcon from "../../icons/brain-circuit-icon";
import CodeXmlIcon from "../../icons/code-xml-icon";
import EyeIcon from "../../icons/eye-icon";
import HistoryCircleIcon from "../../icons/history-circle-icon";
import MailFilledIcon from "../../icons/mail-filled-icon";
import Stack3Icon from "../../icons/stack-3-icon";

const icons = [
  HistoryCircleIcon,
  MailFilledIcon,
  BrainCircuitIcon,
  EyeIcon,
  Stack3Icon,
  CodeXmlIcon
] as const;

/** Decorative mini UI fragments; language-neutral mono/serif data. */
function Fragment({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="grid gap-2">
        {[
          { dot: "bg-[var(--success)]", label: "score_intent", time: "0.4s" },
          { dot: "bg-[var(--warning)]", label: "wait_approval", time: "—" },
          { dot: "bg-[var(--success)]", label: "sales_task", time: "0.8s" }
        ].map((step) => (
          <div key={step.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${step.dot}`} />
            <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--mute)]">{step.label}</span>
            <span className="ml-auto font-mono text-[10px] text-[var(--mute)]">{step.time}</span>
          </div>
        ))}
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
        <p className="font-display text-[13px] italic leading-snug text-[var(--ink)]">
          Follow-up — demo Thursday 10:00
        </p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-[var(--mute)]">to: minh@acme.co</p>
        <div className="mt-2 flex gap-2">
          <span className="inline-flex items-center rounded-[8px] bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-white">
            ✓
          </span>
          <span className="inline-flex items-center rounded-[8px] border border-[var(--hairline-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--mute)]">
            ✕
          </span>
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="flex items-end gap-3">
        <span className="font-display text-3xl leading-none text-[var(--ink)]">87</span>
        <span className="status-pill is-success mb-0.5">high-intent</span>
        <span className="ml-auto mb-0.5 font-mono text-[10px] text-[var(--mute)]">&quot;intent&quot;: 0.87</span>
      </div>
    );
  }

  if (index === 3) {
    return (
      <div className="grid gap-1.5">
        {["prometheus · metrics", "grafana · dashboards", "tempo · traces"].map((row) => (
          <div key={row} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--mute)]">{row}</span>
          </div>
        ))}
      </div>
    );
  }

  if (index === 4) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {["owner", "admin", "member"].map((role) => (
          <span key={role} className="status-pill">
            {role}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px] text-[var(--mute)]">ws-demo</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="status-pill is-success">build</span>
      <span aria-hidden="true" className="font-mono text-[10px] text-[var(--mute)]">→</span>
      <span className="status-pill is-success">test</span>
      <span aria-hidden="true" className="font-mono text-[10px] text-[var(--mute)]">→</span>
      <span className="live-chip">eks</span>
    </div>
  );
}

interface BentoFeature {
  tag: string;
  title: string;
  body: string;
}

function BentoCard({ feature, index }: { feature: BentoFeature; index: number }) {
  const { ref: iconRef, ...iconHandlers } = useIconHover();
  const Icon = icons[index % icons.length];

  return (
    <TiltCard className="rounded-[var(--radius-card)]">
    <Spotlight className="h-full rounded-[var(--radius-card)]">
    <article className="card group h-full p-6 transition-[box-shadow,border-color] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-md)] motion-reduce:transition-none">
      <div className="flex items-center justify-between" {...iconHandlers}>
        <Icon ref={iconRef} size={20} className="text-[var(--accent)]" aria-hidden="true" />
        <span className="mono-label text-[10px]">{feature.tag}</span>
      </div>
      <h3 className="mt-4 text-[20px] font-semibold leading-snug text-[var(--ink)]">{feature.title}</h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-[var(--body)]">{feature.body}</p>
      <div
        aria-hidden="true"
        className="mt-5 rounded-lg border border-[var(--hairline)] bg-[var(--surface-soft)]/60 p-3 [transform:translateZ(28px)]"
      >
        <Fragment index={index} />
      </div>
    </article>
    </Spotlight>
    </TiltCard>
  );
}

export function BentoSection({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const m = t.moss;
  const workflowsHref = `/workflows?lang=${locale}`;

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6 lg:py-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            <span aria-hidden="true" className="text-[var(--accent)]">+</span>
            {m.bentoEyebrow}
          </p>
          <h2 className="font-display mt-3 max-w-[18ch] text-[clamp(32px,4vw,56px)] font-normal leading-[1.08] text-[var(--ink)]">
            {m.bentoTitle}
          </h2>
        </div>
        <Link href={workflowsHref} className="btn btn-ghost hidden min-h-10 sm:inline-flex">
          {t.nav.workflows}
        </Link>
      </div>

      <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {m.bento.map((feature, index) => (
          <StaggerItem key={feature.tag}>
            <BentoCard feature={feature} index={index} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
