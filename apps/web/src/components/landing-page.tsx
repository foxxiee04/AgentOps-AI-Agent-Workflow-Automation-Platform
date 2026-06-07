import Link from "next/link";
import { landingCopy, type Locale } from "../lib/i18n";

export function LandingPage({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const dashboardHref = `/dashboard?lang=${locale}`;
  const appHref = `/login?lang=${locale}&next=${encodeURIComponent(dashboardHref)}`;
  const workflowsHref = `/workflows?lang=${locale}`;
  const builderHref = `/workflows/wf_lead_qualification/builder?lang=${locale}`;

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#1c1917]">
      <header className="border-b border-[#ded7cf] bg-white/95">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link href={locale === "vi" ? "/vi" : "/en"} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[4px] bg-[#1d1a18] text-sm font-bold text-[#ffffff]">AO</span>
            <span className="font-semibold tracking-normal">AgentOps</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#4e4742] md:flex">
            <Link href={appHref}>{t.nav.dashboard}</Link>
            <Link href={workflowsHref}>{t.nav.workflows}</Link>
            <Link href={`/agents?lang=${locale}`}>{t.nav.agents}</Link>
            <Link href={appHref}>{t.nav.login}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={t.otherLocaleHref}
              className="rounded-[4px] border border-[#d5cec5] bg-white px-3 py-2 text-sm font-semibold text-[#4e4742]"
            >
              {t.otherLocaleLabel}
            </Link>
            <Link href={appHref} className="rounded-[4px] bg-[#1d1a18] px-4 py-2 text-sm font-semibold text-[#ffffff]">
              {t.primaryCta}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl content-center gap-10 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-[4px] border border-[#d5cec5] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#4e4742]">
            {t.badge}
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.12] tracking-normal text-[#171412] md:text-6xl">
            {t.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#403a35]">{t.subheadline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={appHref} className="rounded-[4px] bg-[#1d1a18] px-5 py-3 text-sm font-semibold text-[#ffffff]">
              {t.primaryCta}
            </Link>
            <Link
              href={builderHref}
              className="rounded-[4px] border border-[#8f8379] bg-white px-5 py-3 text-sm font-semibold text-[#1c1917]"
            >
              {t.secondaryCta}
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {t.stats.map(([value, label]) => (
              <div key={label} className="border border-[#ded7cf] bg-white px-4 py-3">
                <p className="text-2xl font-bold text-[#171412]">{value}</p>
                <p className="mt-1 text-sm text-[#5f5750]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-[#171412] bg-[#171412] p-4 text-[#ffffff] md:p-6">
          <div className="flex items-center justify-between border-b border-[#4d4640] pb-3 text-sm">
            <span className="font-semibold">{t.terminalTitle}</span>
            <span className="text-[#c9c1b8]">{locale.toUpperCase()}</span>
          </div>
          <pre className="mt-5 overflow-x-auto rounded-[4px] bg-[#24201d] p-4 font-mono text-xs leading-5 text-[#fdfaf6] sm:text-sm">{String.raw`
    _   ____ _____ _   _ _____ ___  ____  ____
   / \ / ___| ____| \ | |_   _/ _ \|  _ \/ ___|
  / _ \ |  _|  _| |  \| | | || | | | |_) \___ \
 / ___ \ |_| | |___| |\  | | || |_| |  __/ ___) |
/_/   \_\____|_____|_| \_| |_| \___/|_|   |____/
`}</pre>
          <div className="mt-4 space-y-2 font-mono text-sm text-[#d8d0c7]">
            {t.terminalLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="border-t border-[#ded7cf] pt-6">
          <h2 className="text-xl font-bold text-[#171412]">[+] {t.productSection}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {t.capabilities.map(([title, detail]) => (
              <article key={title} className="border border-[#ded7cf] bg-white p-4">
                <h3 className="font-semibold text-[#171412]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#4e4742]">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
