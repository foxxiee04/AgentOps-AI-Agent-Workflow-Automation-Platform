import Link from "next/link";
import { Activity, ArrowRight, Bot, CheckCircle2, GitBranch, Globe2, Play, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { landingCopy, type Locale } from "../lib/i18n";
import { Reveal, Stagger, StaggerItem } from "./motion";

const capabilityIcons = [Workflow, Bot, GitBranch, ShieldCheck, Globe2];
const useCaseIcons = [Sparkles, Bot, Activity];
const stackItems = ["Next.js", "NestJS", "Kafka", "PostgreSQL", "Redis", "OpenTelemetry", "Kubernetes", "Terraform"];

export function LandingPage({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const dashboardHref = `/dashboard?lang=${locale}`;
  const appHref = `/login?lang=${locale}&next=${encodeURIComponent(dashboardHref)}`;
  const workflowsHref = `/workflows?lang=${locale}`;
  const builderHref = `/workflows/wf_lead_qualification/builder?lang=${locale}`;

  return (
    <main className="min-h-screen overflow-x-clip text-[var(--ink)]">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
        <div className="lumen-glass mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 rounded-2xl border border-[var(--hairline)] px-4 shadow-[0_10px_30px_-18px_rgba(18,16,60,0.25)] sm:px-5">
          <Link href={locale === "vi" ? "/vi" : "/en"} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(91,75,255,0.8)]">
              AO
            </span>
            <span className="text-[15px] font-extrabold tracking-tight text-[var(--ink-deep)]">AgentOps</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--body)] md:flex">
            <Link href={appHref} className="transition-colors duration-200 hover:text-[var(--accent)]">
              {t.nav.dashboard}
            </Link>
            <Link href={workflowsHref} className="transition-colors duration-200 hover:text-[var(--accent)]">
              {t.nav.workflows}
            </Link>
            <Link href={`/agents?lang=${locale}`} className="transition-colors duration-200 hover:text-[var(--accent)]">
              {t.nav.agents}
            </Link>
            <Link href={appHref} className="transition-colors duration-200 hover:text-[var(--accent)]">
              {t.nav.login}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={t.otherLocaleHref}
              className="hidden rounded-xl border border-[var(--hairline)] bg-white/80 px-3 py-2 text-sm font-semibold text-[var(--body)] sm:inline-flex"
            >
              {t.otherLocaleLabel}
            </Link>
            <Link href={appHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white">
              {t.primaryCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:pt-20">
        <Reveal className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#d9d4ff] bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-[var(--accent-strong)] shadow-[0_6px_18px_-12px_rgba(91,75,255,0.7)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7c5cff] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5b4bff]" />
            </span>
            {t.badge}
          </p>
          <h1 className="mt-6 max-w-3xl text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-[var(--ink-deep)] sm:text-6xl lg:text-[4.2rem]">
            <span className="lumen-gradient-text">{t.headline.split(" ").slice(0, 2).join(" ")}</span>{" "}
            {t.headline.split(" ").slice(2).join(" ")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--body)]">{t.subheadline}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={appHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-6 text-[15px] font-semibold text-white">
              <Play className="h-4 w-4" aria-hidden="true" />
              {t.primaryCta}
            </Link>
            <Link
              href={builderHref}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-white px-6 text-[15px] font-semibold text-[var(--ink)] transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              <Workflow className="h-4 w-4" aria-hidden="true" />
              {t.secondaryCta}
            </Link>
          </div>

          <Stagger className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {t.stats.map(([value, label]) => (
              <StaggerItem key={label}>
                <div className="lumen-card lumen-card-lift h-full px-4 py-4">
                  <p className="lumen-gradient-text text-3xl font-extrabold tracking-tight">{value}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[var(--mute)]">{label}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        <Reveal className="relative min-w-0">
          <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#7c5cff]/25 via-[#ff8ac0]/15 to-[#5cc8ff]/20 blur-3xl" />
          <div className="lumen-dark overflow-hidden rounded-3xl border border-white/10 p-5 shadow-[0_40px_80px_-40px_rgba(40,30,140,0.75)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b8b]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffc457]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#5df2b6]" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[#b9b4ff]">{t.workflowPreviewLabel}</p>
                  <h2 className="text-base font-bold text-white">{t.terminalTitle}</h2>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5df2b6]/30 bg-[#5df2b6]/10 px-3 py-1 text-xs font-semibold text-[#8ff7cf]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5df2b6]" aria-hidden="true" />
                {t.workflowPreviewStatus}
              </span>
            </div>

            <Stagger className="mt-5 grid gap-2.5">
              {t.terminalLines.map((line, index) => (
                <StaggerItem key={line}>
                  <div className="grid grid-cols-[40px_1fr] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 font-mono text-[11px] font-bold text-[#cfcbff]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="truncate font-mono text-[13px] leading-6 text-[#e6e4ff]">{line.replace("[ok] ", "✓ ")}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>

            <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
              {t.flowSignals.map((signal) => (
                <div key={signal} className="flex items-center gap-2 text-sm font-medium text-[#d6d3ff]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5df2b6]" aria-hidden="true" />
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section aria-label={t.stackLabel} className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-[var(--hairline)] bg-white/60 px-6 py-4 text-sm font-semibold text-[var(--mute)]">
          {stackItems.map((item) => (
            <span key={item} className="tracking-tight">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <div className="lumen-card h-full p-7">
            <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t.problemLabel}</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-[var(--ink-deep)]">{t.problemTitle}</h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--body)]">{t.problemBody}</p>
          </div>
        </Reveal>
        <Stagger className="grid gap-4 md:grid-cols-3">
          {t.useCases.map(([title, detail], index) => {
            const Icon = useCaseIcons[index % useCaseIcons.length] ?? Activity;
            return (
              <StaggerItem key={title}>
                <article className="lumen-card lumen-card-lift h-full p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-[var(--ink-deep)]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--body)]">{detail}</p>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--accent)]">{t.stackLabel}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink-deep)]">{t.productSection}</h2>
          </div>
          <Link
            href={workflowsHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-white px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            {t.nav.workflows}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <Stagger className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {t.capabilities.map(([title, detail], index) => {
            const Icon = capabilityIcons[index % capabilityIcons.length] ?? Workflow;
            return (
              <StaggerItem key={title}>
                <article className="lumen-card lumen-card-lift h-full p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold text-[var(--ink-deep)]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--body)]">{detail}</p>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <Reveal>
          <div className="lumen-dark relative overflow-hidden rounded-3xl px-7 py-12 text-center md:px-12 md:py-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl">{t.problemTitle}</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={appHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-[var(--accent-strong)] transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                {t.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={builderHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/25 px-6 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-white/10">
                {t.secondaryCta}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] px-4 py-6 text-sm text-[var(--mute)] sm:px-6">
        <span className="font-semibold text-[var(--ink)]">AgentOps</span>
        <span>AI Agent Workflow Automation Platform</span>
      </footer>
    </main>
  );
}
