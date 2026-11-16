"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from "react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { AuthGate } from "../features/auth/auth-gate";
import { AuthStatus } from "../features/auth/auth-status";
import { apiUrl } from "../lib/api";
import { appCopy, type Locale } from "../lib/i18n";
import BrainCircuitIcon from "../icons/brain-circuit-icon";
import CodeXmlIcon from "../icons/code-xml-icon";
import GearIcon from "../icons/gear-icon";
import HistoryCircleIcon from "../icons/history-circle-icon";
import LayoutDashboardIcon from "../icons/layout-dashboard-icon";
import MailFilledIcon from "../icons/mail-filled-icon";
import Stack3Icon from "../icons/stack-3-icon";
import type { AnimatedIconHandle, AnimatedIconProps } from "../icons/types";
import { LanguageSwitcher } from "./language-switcher";
import { Reveal, useIconHover } from "./motion";

export type AppSection = "dashboard" | "workflows" | "runs" | "approvals" | "builder" | "agents" | "settings";

type NavIcon = ForwardRefExoticComponent<AnimatedIconProps & RefAttributes<AnimatedIconHandle>>;

const navItems: Array<{ href: string; key: AppSection; Icon: NavIcon }> = [
  { href: "/dashboard", key: "dashboard", Icon: LayoutDashboardIcon },
  { href: "/workflows", key: "workflows", Icon: Stack3Icon },
  { href: "/runs", key: "runs", Icon: HistoryCircleIcon },
  { href: "/approvals", key: "approvals", Icon: MailFilledIcon },
  { href: "/workflows/wf_lead_qualification/builder", key: "builder", Icon: CodeXmlIcon },
  { href: "/agents", key: "agents", Icon: BrainCircuitIcon },
  { href: "/settings", key: "settings", Icon: GearIcon }
];

const NAV_SPRING = { type: "spring", visualDuration: 0.35, bounce: 0 } as const;

function withLocale(href: string, locale: Locale) {
  return `${href}?lang=${locale}`;
}

function NavLink({
  href,
  label,
  isActive,
  Icon,
  layoutId,
  variant
}: {
  href: string;
  label: string;
  isActive: boolean;
  Icon: NavIcon;
  layoutId: string;
  variant: "sidebar" | "top";
}) {
  const { ref: iconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();
  const size = variant === "sidebar" ? 18 : 16;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={clsx(
        "group relative flex items-center rounded-xl text-sm font-semibold transition-colors duration-200",
        variant === "sidebar" ? "min-h-11 gap-3 px-2.5" : "min-h-9 shrink-0 gap-2 px-3 py-1.5",
        isActive ? "text-[var(--accent-strong)]" : "text-[var(--body)] hover:text-[var(--ink-deep)]"
      )}
    >
      {isActive ? (
        <motion.span
          layoutId={layoutId}
          aria-hidden="true"
          transition={NAV_SPRING}
          className="absolute inset-0 rounded-xl border border-[#d9d4ff] bg-gradient-to-r from-[#eeecff] to-[#f7f1ff] shadow-[0_6px_16px_-10px_rgba(91,75,255,0.55)]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-[var(--surface-soft)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      )}
      <span
        className={clsx(
          "relative grid shrink-0 place-items-center rounded-lg transition-colors duration-200",
          variant === "sidebar" ? "h-8 w-8" : "h-6 w-6",
          isActive
            ? "bg-white text-[var(--accent)] shadow-[0_2px_6px_rgba(91,75,255,0.25)]"
            : "text-[var(--mute)] group-hover:text-[var(--accent)]"
        )}
      >
        <Icon ref={iconRef} size={size} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="relative truncate">{label}</span>
    </Link>
  );
}

function BrandMark() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-sm font-extrabold tracking-tight text-white shadow-[0_10px_22px_-10px_rgba(91,75,255,0.8)]">
      AO
    </span>
  );
}

export function AppShell({ children, active, locale }: { children: ReactNode; active?: AppSection; locale: Locale }) {
  const t = appCopy[locale];
  const pathname = usePathname();

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <aside className="lumen-glass fixed inset-y-0 left-0 hidden w-[17rem] flex-col border-r border-[var(--hairline)] px-4 py-5 lg:flex">
        <Link href={locale === "vi" ? "/vi" : "/en"} className="flex items-center gap-3 px-1">
          <BrandMark />
          <span>
            <span className="block text-[15px] font-extrabold tracking-tight text-[var(--ink-deep)]">AgentOps</span>
            <span className="block text-xs text-[var(--mute)]">AI workflow control</span>
          </span>
        </Link>
        <nav className="mt-8 flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={withLocale(item.href, locale)}
              label={t.shell.nav[item.key]}
              isActive={active === item.key}
              Icon={item.Icon}
              layoutId="nav-active"
              variant="sidebar"
            />
          ))}
        </nav>
        <div className="lumen-dark relative overflow-hidden rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase text-[#b9b4ff]">{t.shell.workspace}</p>
          <p className="mt-1 truncate text-sm font-bold text-white">{t.shell.demoWorkspace}</p>
          <p className="mt-3 flex items-center gap-2 text-xs text-[#cfcbff]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5df2b6] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5df2b6]" />
            </span>
            Kafka · PostgreSQL · Redis
          </p>
        </div>
      </aside>
      <main className="min-w-0 lg:pl-[17rem]">
        <header className="lumen-glass sticky top-0 z-20 border-b border-[var(--hairline)]">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-2 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="lg:hidden">
                <BrandMark />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase text-[var(--mute)]">{t.shell.workspace}</p>
                <p className="truncate text-sm font-bold text-[var(--ink-deep)]">{t.shell.demoWorkspace}</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <AuthStatus locale={locale} labels={t.shell} />
              <div className="hidden max-w-[320px] truncate rounded-full border border-[var(--hairline)] bg-white/70 px-3 py-1.5 font-mono text-xs text-[var(--mute)] xl:block">
                {t.shell.api} {apiUrl}
              </div>
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-[var(--hairline)] px-2 py-2 lg:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={withLocale(item.href, locale)}
                label={t.shell.nav[item.key]}
                isActive={active === item.key}
                Icon={item.Icon}
                layoutId="nav-active-mobile"
                variant="top"
              />
            ))}
          </nav>
        </header>
        <AuthGate locale={locale}>
          <Reveal key={`${pathname}:${locale}`} className="mx-auto min-w-0 max-w-[1500px] lg:px-3">
            {children}
          </Reveal>
        </AuthGate>
      </main>
    </div>
  );
}
