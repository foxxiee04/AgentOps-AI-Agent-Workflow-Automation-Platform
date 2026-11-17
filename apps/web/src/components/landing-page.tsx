import Link from "next/link";
import { landingCopy, type Locale } from "../lib/i18n";
import { Reveal, Stagger, StaggerItem } from "./motion";
import { BentoSection } from "./landing/bento";
import { DashboardPreview } from "./landing/dashboard-preview";
import { Hero } from "./landing/hero";
import { Marquee } from "./landing/marquee";

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M11 1.6 19.9 6.7v10.6L11 22.4 2.1 17.3V6.7L11 1.6Z"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="12" r="2.4" fill="var(--live)" stroke="var(--ink)" strokeWidth="1" />
    </svg>
  );
}

export function LandingPage({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const m = t.moss;
  const dashboardHref = `/dashboard?lang=${locale}`;
  const appHref = `/login?lang=${locale}&next=${encodeURIComponent(dashboardHref)}`;
  const registerHref = `/register?lang=${locale}`;
  const workflowsHref = `/workflows?lang=${locale}`;
  const agentsHref = `/agents?lang=${locale}`;

  return (
    <main className="min-h-screen overflow-x-clip text-[var(--body)]">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-4 rounded-[var(--radius-card)] px-4 shadow-[var(--shadow-sm)] sm:px-5">
          <Link href={locale === "vi" ? "/vi" : "/en"} className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-[19px] text-[var(--ink)]">AgentOps</span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
            <Link href={dashboardHref} className="mono-label transition-colors hover:text-[var(--ink)]">
              {t.nav.dashboard}
            </Link>
            <Link href={workflowsHref} className="mono-label transition-colors hover:text-[var(--ink)]">
              {t.nav.workflows}
            </Link>
            <Link href={agentsHref} className="mono-label transition-colors hover:text-[var(--ink)]">
              {t.nav.agents}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={t.otherLocaleHref}
              className="mono-label hidden px-2 py-2 transition-colors hover:text-[var(--ink)] sm:inline-flex"
            >
              {t.otherLocaleLabel}
            </Link>
            <Link href={appHref} className="btn btn-ghost min-h-10 hidden sm:inline-flex">
              {t.nav.login}
            </Link>
            <Link href={appHref} className="btn btn-primary min-h-10 px-4">
              {t.primaryCta}
            </Link>
          </div>
        </div>
      </header>

      <Hero locale={locale} />

      <Marquee locale={locale} />

      <section className="hairline-grid relative mx-auto max-w-[1240px] px-4 py-20 sm:px-6 lg:py-32">
        <span aria-hidden="true" className="crosshair absolute left-6 top-10 z-10 hidden h-0 w-0 lg:block" />
        <span aria-hidden="true" className="crosshair absolute right-6 top-10 z-10 hidden h-0 w-0 lg:block" />
        <Reveal>
          <div className="max-w-[42ch]">
            <p className="eyebrow">
              <span aria-hidden="true" className="text-[var(--accent)]">+</span>
              {m.howEyebrow}
            </p>
            <h2 className="font-display mt-3 text-[clamp(32px,4vw,56px)] font-normal leading-[1.08] text-[var(--ink)]">
              {m.howTitle}
            </h2>
          </div>
        </Reveal>
        <Stagger className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[var(--hairline)]">
          {m.steps.map((step, index) => (
            <StaggerItem key={step.title}>
              <div className="md:px-8 md:first:pl-0 md:last:pr-0">
                <p className="mono-label text-[var(--accent)]">{`0${index + 1} /`}</p>
                <h3 className="font-display mt-4 text-[24px] font-normal leading-snug text-[var(--ink)]">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-[var(--body)]">{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <BentoSection locale={locale} />

      <section className="mx-auto max-w-[1240px] px-4 pb-20 sm:px-6 lg:pb-32">
        <Reveal>
          <div className="max-w-[42ch]">
            <p className="eyebrow">
              <span aria-hidden="true" className="text-[var(--accent)]">+</span>
              {m.previewEyebrow}
            </p>
            <h2 className="font-display mt-3 text-[clamp(32px,4vw,56px)] font-normal leading-[1.08] text-[var(--ink)]">
              {m.previewTitle}
            </h2>
          </div>
        </Reveal>
        <div className="mt-10">
          <DashboardPreview locale={locale} />
        </div>
      </section>

      <section className="hairline-grid relative mx-auto max-w-[1240px] px-4 pb-24 pt-4 sm:px-6">
        <span aria-hidden="true" className="crosshair absolute left-6 top-0 z-10 hidden h-0 w-0 lg:block" />
        <span aria-hidden="true" className="crosshair absolute right-6 top-0 z-10 hidden h-0 w-0 lg:block" />
        <Reveal>
          <div className="mx-auto max-w-[640px] text-center">
            <p className="eyebrow justify-center">
              <span aria-hidden="true" className="text-[var(--accent)]">+</span>
              {m.ctaEyebrow}
            </p>
            <h2 className="font-display mt-4 text-[clamp(32px,4.5vw,64px)] font-normal leading-[1.05] text-[var(--ink)]">
              {m.ctaTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.6] text-[var(--body)]">{m.ctaBody}</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href={appHref} className="btn btn-primary min-h-12 px-7 text-[15px]">
                {t.primaryCta}
              </Link>
              <Link href={registerHref} className="btn btn-secondary min-h-12 px-7 text-[15px]">
                {m.registerCta}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
          <span className="flex items-center gap-2">
            <BrandMark className="h-4 w-[18px]" />
            <span className="font-display text-[15px] text-[var(--ink)]">AgentOps</span>
          </span>
          <p className="font-mono text-[11px] tracking-[0.08em] text-[var(--mute)]">{m.footerNote}</p>
          <Link
            href={t.otherLocaleHref}
            className="mono-label transition-colors hover:text-[var(--ink)]"
          >
            {t.otherLocaleLabel}
          </Link>
        </div>
      </footer>
    </main>
  );
}
