import Link from "next/link";
import { Activity, ArrowRight, Bot, CheckCircle2, GitBranch, Globe2, Play, ShieldCheck, Workflow } from "lucide-react";
import { landingCopy, type Locale } from "../lib/i18n";

const capabilityIcons = [Workflow, Bot, GitBranch, ShieldCheck, Globe2];

export function LandingPage({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const dashboardHref = `/dashboard?lang=${locale}`;
  const appHref = `/login?lang=${locale}&next=${encodeURIComponent(dashboardHref)}`;
  const workflowsHref = `/workflows?lang=${locale}`;
  const builderHref = `/workflows/wf_lead_qualification/builder?lang=${locale}`;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={locale === "vi" ? "/vi" : "/en"} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[var(--accent)] text-sm font-bold text-white">AO</span>
            <span className="font-semibold tracking-normal text-[var(--ink-deep)]">AgentOps</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--body)] md:flex">
            <Link href={appHref}>{t.nav.dashboard}</Link>
            <Link href={workflowsHref}>{t.nav.workflows}</Link>
            <Link href={`/agents?lang=${locale}`}>{t.nav.agents}</Link>
            <Link href={appHref}>{t.nav.login}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={t.otherLocaleHref}
              className="rounded-[8px] border border-[var(--hairline)] bg-white px-3 py-2 text-sm font-semibold text-[var(--body)]"
            >
              {t.otherLocaleLabel}
            </Link>
            <Link href={appHref} className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              {t.primaryCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-16">
        <div className="min-w-0">
          <p className="inline-flex rounded-[999px] border border-[var(--hairline)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--body)]">
            {t.badge}
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-normal text-[var(--ink-deep)] md:text-6xl">
            {t.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--body)]">{t.subheadline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={appHref} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[var(--accent)] px-5 text-sm font-semibold text-white">
              <Play className="h-4 w-4" aria-hidden="true" />
              {t.primaryCta}
            </Link>
            <Link
              href={builderHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--hairline-strong)] bg-white px-5 text-sm font-semibold text-[var(--ink)]"
            >
              <Workflow className="h-4 w-4" aria-hidden="true" />
              {t.secondaryCta}
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {t.stats.map(([value, label]) => (
              <div key={label} className="rounded-[8px] border border-[var(--hairline)] bg-white px-4 py-3">
                <p className="text-2xl font-bold text-[var(--ink-deep)]">{value}</p>
                <p className="mt-1 text-sm text-[var(--mute)]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-[var(--hairline)] bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--mute)]">{t.workflowPreviewLabel}</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--ink-deep)]">{t.terminalTitle}</h2>
            </div>
            <span className="rounded-[999px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#166534]">
              {t.workflowPreviewStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {t.terminalLines.map((line, index) => (
              <div key={line} className="grid grid-cols-[44px_1fr] gap-3 rounded-[8px] border border-[var(--hairline)] bg-[#fbfcff] p-3">
                <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[var(--accent-soft)] font-mono text-xs font-bold text-[var(--accent)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="self-center font-mono text-sm leading-6 text-[var(--charcoal)]">{line}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 border-t border-[var(--hairline)] pt-4 sm:grid-cols-3">
            {t.flowSignals.map((signal) => (
              <div key={signal} className="flex items-center gap-2 text-sm font-medium text-[var(--body)]">
                <CheckCircle2 className="h-4 w-4 text-[#15803d]" aria-hidden="true" />
                <span>{signal}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[12px] border border-[var(--hairline)] bg-white p-5">
          <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.problemLabel}</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--ink-deep)]">{t.problemTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--body)]">{t.problemBody}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {t.useCases.map(([title, detail]) => (
            <article key={title} className="rounded-[12px] border border-[var(--hairline)] bg-white p-4">
              <Activity className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-[var(--ink-deep)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--body)]">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="border-t border-[var(--hairline)] pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.stackLabel}</p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--ink-deep)]">{t.productSection}</h2>
            </div>
            <Link href={workflowsHref} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--hairline-strong)] bg-white px-4 text-sm font-semibold text-[var(--ink)]">
              {t.nav.workflows}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {t.capabilities.map(([title, detail], index) => {
              const Icon = capabilityIcons[index % capabilityIcons.length];
              return (
                <article key={title} className="rounded-[12px] border border-[var(--hairline)] bg-white p-4">
                  <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-[var(--ink-deep)]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--body)]">{detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
