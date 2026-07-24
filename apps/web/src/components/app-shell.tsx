import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { AuthGate } from "../features/auth/auth-gate";
import { AuthStatus } from "../features/auth/auth-status";
import { apiUrl } from "../lib/api";
import { appCopy, type Locale } from "../lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export type AppSection = "dashboard" | "workflows" | "runs" | "builder" | "agents" | "settings";

const navItems: Array<{ href: string; key: AppSection; marker: string }> = [
  { href: "/dashboard", key: "dashboard", marker: "[0]" },
  { href: "/workflows", key: "workflows", marker: "[1]" },
  { href: "/runs", key: "runs", marker: "[2]" },
  { href: "/workflows/wf_lead_qualification/builder", key: "builder", marker: "[3]" },
  { href: "/agents", key: "agents", marker: "[4]" },
  { href: "/settings", key: "settings", marker: "[5]" }
];

function withLocale(href: string, locale: Locale) {
  return `${href}?lang=${locale}`;
}

export function AppShell({ children, active, locale }: { children: ReactNode; active?: AppSection; locale: Locale }) {
  const t = appCopy[locale];

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[17rem] border-r border-[var(--hairline)] bg-white px-4 py-5 lg:block">
        <Link href={locale === "vi" ? "/vi" : "/en"} className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-[var(--accent)] text-sm font-bold text-white">AO</span>
          <span>
            <span className="block text-sm font-bold text-[var(--ink-deep)]">AgentOps</span>
            <span className="block text-xs text-[var(--mute)]">AI workflow control</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1 border-t border-[var(--hairline)] pt-3">
          {navItems.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.href}
                href={withLocale(item.href, locale)}
                className={clsx(
                  "flex min-h-10 items-center gap-3 rounded-[8px] border px-3 text-sm font-semibold",
                  isActive
                    ? "border-[#c7d2fe] bg-[var(--accent-soft)] text-[#17337a]"
                    : "border-transparent text-[var(--body)] hover:border-[var(--hairline)] hover:bg-[#f8faff]"
                )}
              >
                <span className={clsx("font-mono text-xs", isActive ? "text-[var(--accent)]" : "text-[var(--mute)]")}>{item.marker}</span>
                {t.shell.nav[item.key]}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[var(--mute)]">{t.shell.workspace}</p>
              <p className="truncate text-sm font-bold text-[var(--ink-deep)]">{t.shell.demoWorkspace}</p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <AuthStatus locale={locale} labels={t.shell} />
              <div className="hidden max-w-[320px] truncate rounded-[8px] border border-[var(--hairline)] bg-white px-3 py-2 text-xs font-semibold text-[var(--body)] xl:block">
                {t.shell.api} {apiUrl}
              </div>
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-[var(--hairline)] px-2 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = active === item.key;
              return (
                <Link
                  key={item.href}
                  href={withLocale(item.href, locale)}
                  className={clsx(
                    "min-h-9 shrink-0 rounded-[8px] border px-3 py-1.5 text-sm font-semibold",
                    isActive ? "border-[#c7d2fe] bg-[var(--accent-soft)] text-[#17337a]" : "border-transparent text-[var(--body)]"
                  )}
                >
                  <span className="font-mono">{item.marker}</span> {t.shell.nav[item.key]}
                </Link>
              );
            })}
          </nav>
        </header>
        <AuthGate locale={locale}>{children}</AuthGate>
      </main>
    </div>
  );
}
