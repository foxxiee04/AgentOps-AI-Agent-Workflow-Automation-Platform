import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { ErrorState } from "../../components/data-state";
import { apiGet } from "../../lib/server-api";
import { ApiError } from "../../lib/api";
import { appCopy, normalizeLocale, type Locale } from "../../lib/i18n";
import type { AuthUser } from "../../features/auth/auth-client";
import { AdminDenied, AdminTabs, type AdminLabels, type AdminTabKey } from "../../features/admin/admin-ui";
import { AdminAccountsTable } from "../../features/admin/accounts-table";
import { AdminAuditTable } from "../../features/admin/audit-table";
import { AdminOverviewView } from "../../features/admin/overview";
import { AdminWorkspacesTable } from "../../features/admin/workspaces-table";
import { adminOverviewSchema, type AdminOverview } from "../../features/admin/schemas";

type AdminSearchParams = {
  lang?: string | string[];
  tab?: string | string[];
  days?: string | string[];
};

const tabKeys: AdminTabKey[] = ["overview", "accounts", "workspaces", "audit"];
const dayOptions = [7, 30, 90] as const;
type DayOption = (typeof dayOptions)[number];

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTab(value: string | undefined): AdminTabKey {
  return tabKeys.includes(value as AdminTabKey) ? (value as AdminTabKey) : "overview";
}

function normalizeDays(value: string | undefined): DayOption {
  const parsed = Number(value);
  return dayOptions.includes(parsed as DayOption) ? (parsed as DayOption) : 30;
}

function overviewHref(locale: Locale, days: DayOption): string {
  return `/admin?lang=${locale}&tab=overview&days=${days}`;
}

function PageHeader({
  labels,
  locale,
  days,
  showRange
}: {
  labels: AdminLabels;
  locale: Locale;
  days: DayOption;
  showRange: boolean;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <p className="mono-label">{labels.eyebrow}</p>
        <h1 className="mt-1 font-display text-[34px] font-medium leading-tight text-[var(--ink)]">{labels.title}</h1>
        <p className="mt-1 text-sm text-[var(--mute)]">{labels.subtitle}</p>
      </div>
      {showRange ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-label">{labels.range.label}</span>
          <div className="flex gap-1">
            {dayOptions.map((option) => {
              const isActive = option === days;
              return (
                <Link
                  key={option}
                  href={overviewHref(locale, option)}
                  aria-current={isActive ? "true" : undefined}
                  className={
                    isActive
                      ? "inline-flex min-h-8 items-center rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 font-mono text-xs font-medium text-[var(--accent-strong)]"
                      : "inline-flex min-h-8 items-center rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] px-3 font-mono text-xs text-[var(--body)] transition-colors hover:border-[var(--hairline-strong)] hover:text-[var(--ink)]"
                  }
                >
                  {labels.range[`d${option}`]}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<AdminSearchParams | undefined>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const locale = normalizeLocale(resolved?.lang);
  const t = appCopy[locale];
  const labels = t.admin;
  const tab = normalizeTab(readParam(resolved?.tab));
  const days = normalizeDays(readParam(resolved?.days));

  let me: AuthUser | undefined;
  let authError: string | undefined;
  try {
    me = await apiGet<AuthUser>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?lang=${locale}`);
    }
    authError = error instanceof Error ? error.message : "API request failed";
  }

  if (!me) {
    return (
      <AppShell active="admin" locale={locale}>
        <div className="space-y-6 p-5 lg:p-8">
          <PageHeader labels={labels} locale={locale} days={days} showRange={false} />
          <ErrorState labels={t.states} detail={authError} />
        </div>
      </AppShell>
    );
  }

  if (me.isPlatformAdmin !== true) {
    return (
      <AppShell active="admin" locale={locale}>
        <div className="space-y-6 p-5 lg:p-8">
          <PageHeader labels={labels} locale={locale} days={days} showRange={false} />
          <AdminDenied labels={labels} />
        </div>
      </AppShell>
    );
  }

  let overview: AdminOverview | undefined;
  let overviewError: string | undefined;
  let forbidden = false;

  if (tab === "overview") {
    try {
      overview = await apiGet(`/admin/overview?days=${days}`, adminOverviewSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(`/login?lang=${locale}`);
      }
      if (error instanceof ApiError && error.status === 403) {
        forbidden = true;
      } else {
        overviewError = error instanceof Error ? error.message : "API request failed";
      }
    }
  }

  return (
    <AppShell active="admin" locale={locale}>
      <div className="space-y-6 p-5 lg:p-8">
        <PageHeader labels={labels} locale={locale} days={days} showRange={tab === "overview"} />
        <AdminTabs active={tab} locale={locale} days={days} labels={labels} />

        {forbidden ? (
          <AdminDenied labels={labels} />
        ) : tab === "overview" ? (
          overviewError ? (
            <ErrorState labels={t.states} detail={overviewError} />
          ) : overview ? (
            <AdminOverviewView overview={overview} labels={labels} locale={locale} days={days} />
          ) : null
        ) : tab === "accounts" ? (
          <AdminAccountsTable labels={labels} locale={locale} currentUserId={me.id} />
        ) : tab === "workspaces" ? (
          <AdminWorkspacesTable labels={labels} locale={locale} />
        ) : (
          <AdminAuditTable labels={labels} locale={locale} />
        )}
      </div>
    </AppShell>
  );
}
