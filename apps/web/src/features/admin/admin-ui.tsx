import Link from "next/link";
import { clsx } from "clsx";
import { EmptyState } from "../../components/data-state";
import type { AppCopy, Locale } from "../../lib/i18n";

export type AdminLabels = AppCopy["admin"];
export type AdminTabKey = "overview" | "accounts" | "workspaces" | "audit";

const tabOrder: AdminTabKey[] = ["overview", "accounts", "workspaces", "audit"];

export function adminTabHref(tab: AdminTabKey, locale: Locale, days?: number): string {
  const params = new URLSearchParams();
  params.set("lang", locale);
  params.set("tab", tab);
  if (tab === "overview" && days) {
    params.set("days", String(days));
  }
  return `/admin?${params.toString()}`;
}

export function AdminTabs({
  active,
  locale,
  days,
  labels
}: {
  active: AdminTabKey;
  locale: Locale;
  days: number;
  labels: AdminLabels;
}) {
  return (
    <nav aria-label={labels.title} className="flex flex-wrap gap-1.5 border-b border-[var(--hairline)] pb-3">
      {tabOrder.map((tab) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={adminTabHref(tab, locale, days)}
            aria-current={isActive ? "page" : undefined}
            className={clsx(
              "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors duration-200",
              isActive
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]"
                : "border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--body)] hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
            )}
          >
            {labels.tabs[tab]}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminDenied({ labels }: { labels: AdminLabels }) {
  return <EmptyState title={labels.noPermissionTitle} body={labels.noPermissionBody} />;
}

export function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AdminAvatar({
  name,
  email,
  avatarUrl,
  size = 32
}: {
  name: string;
  email: string;
  avatarUrl?: string;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--hairline)] object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] font-mono text-[11px] font-semibold text-[var(--accent-strong)]"
      style={{ width: size, height: size }}
    >
      {initials(name, email)}
    </span>
  );
}

export function formatAdminDate(value: string | null | undefined, locale: Locale, withTime = true): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {})
  }).format(date);
}

export function formatAdminNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(value);
}

export function adminPageInfo(template: string, page: number, totalPages: number, total: number): string {
  return template
    .replace("{page}", String(page))
    .replace("{totalPages}", String(Math.max(1, totalPages)))
    .replace("{total}", String(total));
}

export function AdminPagination({
  page,
  totalPages,
  total,
  labels,
  onPage
}: {
  page: number;
  totalPages: number;
  total: number;
  labels: Pick<AdminLabels["accounts"], "prev" | "next" | "pageInfo">;
  onPage: (page: number) => void;
}) {
  const maxPage = Math.max(1, totalPages);
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[var(--hairline)] px-3 py-3 text-sm text-[var(--ink-deep)]">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="btn btn-ghost min-h-8 px-2 disabled:opacity-40"
      >
        ‹ {labels.prev}
      </button>
      <span className="font-mono text-xs text-[var(--mute)]">{adminPageInfo(labels.pageInfo, page, maxPage, total)}</span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= maxPage}
        className="btn btn-ghost min-h-8 px-2 disabled:opacity-40"
      >
        {labels.next} ›
      </button>
    </div>
  );
}

export function AdminTableShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]">
      {children}
    </section>
  );
}
