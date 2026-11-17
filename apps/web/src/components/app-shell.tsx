"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ForwardRefExoticComponent, type ReactNode, type RefAttributes } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AuthGate } from "../features/auth/auth-gate";
import { AuthStatus } from "../features/auth/auth-status";
import { useActiveWorkspace } from "../features/auth/use-active-workspace";
import { apiUrl } from "../lib/api";
import { appCopy, type AppCopy, type Locale } from "../lib/i18n";
import BrainCircuitIcon from "../icons/brain-circuit-icon";
import CodeXmlIcon from "../icons/code-xml-icon";
import GearIcon from "../icons/gear-icon";
import HistoryCircleIcon from "../icons/history-circle-icon";
import LayoutDashboardIcon from "../icons/layout-dashboard-icon";
import MailFilledIcon from "../icons/mail-filled-icon";
import Stack3Icon from "../icons/stack-3-icon";
import XIcon from "../icons/x-icon";
import type { AnimatedIconHandle, AnimatedIconProps } from "../icons/types";
import { LanguageSwitcher } from "./language-switcher";
import { EASE_OUT, Reveal, useIconHover } from "./motion";

export type AppSection = "dashboard" | "workflows" | "runs" | "approvals" | "builder" | "agents" | "settings" | "admin";

type NavIcon = ForwardRefExoticComponent<AnimatedIconProps & RefAttributes<AnimatedIconHandle>>;

type NavItem = { href: string; key: AppSection; Icon: NavIcon };

const navItems: NavItem[] = [
  { href: "/dashboard", key: "dashboard", Icon: LayoutDashboardIcon },
  { href: "/workflows", key: "workflows", Icon: Stack3Icon },
  { href: "/runs", key: "runs", Icon: HistoryCircleIcon },
  { href: "/approvals", key: "approvals", Icon: MailFilledIcon },
  { href: "/workflows/wf_lead_qualification/builder", key: "builder", Icon: CodeXmlIcon },
  { href: "/agents", key: "agents", Icon: BrainCircuitIcon },
  { href: "/settings", key: "settings", Icon: GearIcon }
];

const adminNavItem: NavItem = { href: "/admin", key: "admin", Icon: GearIcon };

const NAV_SPRING = { type: "spring", visualDuration: 0.35, bounce: 0 } as const;
const SHEET_DURATION = 0.4;

function withLocale(href: string, locale: Locale) {
  return `${href}?lang=${locale}`;
}

function NavLink({
  href,
  label,
  isActive,
  Icon,
  layoutId,
  variant,
  onNavigate
}: {
  href: string;
  label: string;
  isActive: boolean;
  Icon: NavIcon;
  layoutId: string;
  variant: "sidebar" | "top";
  onNavigate?: () => void;
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
      onClick={onNavigate}
      className={clsx(
        "group relative flex items-center transition-colors duration-200",
        variant === "sidebar"
          ? "min-h-10 gap-3 rounded-[var(--radius-control)] pl-3 pr-2.5 text-sm"
          : "min-h-8 shrink-0 gap-2 rounded-full px-2.5 py-1.5 text-[13px]",
        variant === "sidebar" && isActive ? "font-medium" : "font-normal",
        isActive ? "text-[var(--accent)]" : "text-[var(--body)] hover:text-[var(--ink)]"
      )}
    >
      {isActive ? (
        <motion.span
          layoutId={layoutId}
          aria-hidden="true"
          transition={NAV_SPRING}
          className={clsx(
            "absolute inset-0 bg-[var(--accent-soft)]",
            variant === "sidebar" ? "rounded-[var(--radius-control)]" : "rounded-full"
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={clsx(
            "absolute inset-0 bg-[var(--surface-card)] opacity-0 transition-opacity duration-200 group-hover:opacity-100",
            variant === "sidebar" ? "rounded-[var(--radius-control)]" : "rounded-full"
          )}
        />
      )}
      {isActive && variant === "sidebar" ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)]"
        />
      ) : null}
      <span
        className={clsx(
          "relative grid shrink-0 place-items-center transition-colors duration-200",
          variant === "sidebar" ? "h-5 w-5" : "h-4 w-4",
          isActive ? "text-[var(--accent)]" : "text-[var(--mute)] group-hover:text-[var(--accent)]"
        )}
      >
        <Icon ref={iconRef} size={size} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="relative truncate">{label}</span>
    </Link>
  );
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative grid shrink-0 place-items-center text-[var(--accent)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
        <path
          d="M16 2.4 28 9.3v13.4L16 29.6 4 22.7V9.3Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path d="M16 10.5v11M10.2 13.8l11.6 6.4M21.8 13.8l-11.6 6.4" stroke="currentColor" strokeWidth={1} strokeOpacity={0.35} />
        <circle cx="16" cy="16" r="2.8" fill="var(--live)" />
      </svg>
    </span>
  );
}

function WorkspaceSwitcher({ labels, id }: { labels: AppCopy["shell"]; id: string }) {
  const { workspaces, active, setActiveWorkspace } = useActiveWorkspace();

  if (!workspaces || workspaces.length === 0) {
    return null;
  }

  if (workspaces.length === 1) {
    const single = workspaces[0];
    return (
      <div className="rounded-[var(--radius-control)] border border-[var(--hairline)] bg-[var(--surface-card)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
        <p className="mono-label">{labels.workspace}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--ink)]">{single.name}</span>
          <span className="mono-label shrink-0 rounded-[4px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent-strong)]">
            {single.role}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--hairline)] bg-[var(--surface-card)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <label htmlFor={id} className="mono-label block">
        {labels.workspace}
      </label>
      <select
        id={id}
        aria-label={labels.switchWorkspace}
        value={active?.id ?? ""}
        onChange={(e) => setActiveWorkspace(e.target.value)}
        className="mt-1.5 h-9 w-full cursor-pointer truncate rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.id === active?.id ? `✓ ${ws.name} (${ws.role})` : `${ws.name} (${ws.role})`}
          </option>
        ))}
      </select>
    </div>
  );
}

function SidebarContent({
  locale,
  t,
  active,
  items,
  navLayoutId,
  switcherId,
  onNavigate,
  onClose
}: {
  locale: Locale;
  t: AppCopy;
  active?: AppSection;
  items: NavItem[];
  navLayoutId: string;
  switcherId: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const { ref: closeIconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={locale === "vi" ? "/vi" : "/en"}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5"
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate font-display text-[21px] leading-none text-[var(--ink)]">AgentOps</span>
            <span className="mono-label mt-1.5 block truncate">AI workflow control</span>
          </span>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            aria-label={locale === "vi" ? "Đóng điều hướng" : "Close navigation"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
          >
            <XIcon ref={closeIconRef} size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        <WorkspaceSwitcher labels={t.shell} id={switcherId} />
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5" aria-label={t.shell.workspace}>
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={withLocale(item.href, locale)}
            label={t.shell.nav[item.key]}
            isActive={active === item.key}
            Icon={item.Icon}
            layoutId={navLayoutId}
            variant="sidebar"
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-4 space-y-3 border-t border-[var(--hairline)] pt-4">
        <p className="flex items-center gap-2 px-1 text-xs text-[var(--body)]">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--live)]" />
          <span className="truncate">Kafka · PostgreSQL · Redis</span>
        </p>
        <div className="[&>div]:flex [&>div]:w-full [&>div]:flex-wrap [&>div]:items-center [&>div]:justify-between">
          <AuthStatus locale={locale} labels={t.shell} />
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M3.5 7h17M3.5 12h17M3.5 17h17" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function AppShell({ children, active, locale }: { children: ReactNode; active?: AppSection; locale: Locale }) {
  const t = appCopy[locale];
  const pathname = usePathname();
  const { active: currentWorkspace, user } = useActiveWorkspace();
  const workspaceName = currentWorkspace?.name ?? t.shell.demoWorkspace;
  const visibleNavItems = user?.isPlatformAdmin ? [...navItems, adminNavItem] : navItems;
  const prefersReduced = useReducedMotion() ?? false;
  const [sheetOpen, setSheetOpen] = useState(false);
  const sectionLabel = active ? t.shell.nav[active] : t.shell.workspace;
  const navLabel = locale === "vi" ? "Điều hướng" : "Navigation";

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSheetOpen(false);
      }
    }

    function onViewportChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setSheetOpen(false);
      }
    }

    if (desktop.matches) {
      setSheetOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onViewportChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onViewportChange);
    };
  }, [sheetOpen]);

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col overflow-y-auto border-r border-[var(--hairline)] bg-[var(--surface-soft)] px-4 py-5 lg:flex">
        <SidebarContent
          locale={locale}
          t={t}
          active={active}
          items={visibleNavItems}
          navLayoutId="nav-active"
          switcherId="workspace-switcher"
        />
      </aside>

      <AnimatePresence>
        {sheetOpen ? (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.2, ease: EASE_OUT }}
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-40 bg-[var(--ink)]/30 lg:hidden"
            aria-hidden="true"
          />
        ) : null}
        {sheetOpen ? (
          <motion.aside
            key="sheet"
            id="app-mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label={navLabel}
            initial={prefersReduced ? { opacity: 0 } : { x: "-100%" }}
            animate={prefersReduced ? { opacity: 1 } : { x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: SHEET_DURATION, ease: EASE_OUT }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-[var(--hairline)] bg-[var(--surface-soft)] px-4 py-5 shadow-[var(--shadow-md)] lg:hidden"
          >
            <SidebarContent
              locale={locale}
              t={t}
              active={active}
              items={visibleNavItems}
              navLayoutId="nav-active-sheet"
              switcherId="workspace-switcher-sheet"
              onNavigate={() => setSheetOpen(false)}
              onClose={() => setSheetOpen(false)}
            />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0 lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--glass)] backdrop-blur-[16px] backdrop-saturate-150">
          <div className="flex min-h-16 items-center gap-3 px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={navLabel}
              aria-expanded={sheetOpen}
              aria-controls="app-mobile-sidebar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--ink)] transition-colors hover:border-[var(--hairline-strong)] lg:hidden"
            >
              <MenuIcon />
            </button>
            <p className="mono-label min-w-0 truncate">
              <span className="text-[var(--mute)]">AgentOps</span>
              <span aria-hidden="true" className="mx-1.5 text-[var(--ash)]">
                /
              </span>
              <span className="hidden text-[var(--mute)] sm:inline">{workspaceName}</span>
              <span aria-hidden="true" className="mx-1.5 hidden text-[var(--ash)] sm:inline">
                /
              </span>
              <span className="text-[var(--ink)]">{sectionLabel}</span>
            </p>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <div className="hidden max-w-[300px] truncate rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] px-3 py-1.5 font-mono text-[11px] text-[var(--mute)] xl:block">
                {t.shell.api} {apiUrl}
              </div>
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
          <nav
            aria-label={navLabel}
            className="flex gap-1 overflow-x-auto border-t border-[var(--hairline)] px-2 py-1.5 lg:hidden"
          >
            {visibleNavItems.map((item) => (
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
          <Reveal key={`${pathname}:${locale}`} className="mx-auto w-full min-w-0 max-w-[1320px]">
            {children}
          </Reveal>
        </AuthGate>
      </main>
    </div>
  );
}
