"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import type { Locale } from "../../lib/i18n";
import { StatusPill } from "../../components/status-pill";
import { fetchAdminUser, fetchAdminUsers, updateAdminUser, type AdminUserStatus } from "./api";
import {
  AdminAvatar,
  AdminDenied,
  AdminPagination,
  AdminTableShell,
  formatAdminDate,
  adminPageInfo,
  type AdminLabels
} from "./admin-ui";
import type { AdminMembership, AdminUser, AdminUserPatch, AdminUsersPage } from "./schemas";

export function optimisticUserPatch(items: AdminUser[], id: string, patch: AdminUserPatch): AdminUser[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/**
 * Applies a PATCH and returns the settled list. On failure the original snapshot is returned so the
 * caller can roll the optimistic row back; the error message is surfaced separately.
 */
export async function runUserPatch(
  items: AdminUser[],
  id: string,
  patch: AdminUserPatch,
  request: (id: string, patch: AdminUserPatch) => Promise<AdminUser> = updateAdminUser
): Promise<{ items: AdminUser[]; updated?: AdminUser; error?: string }> {
  try {
    const updated = await request(id, patch);
    return {
      items: items.map((item) => (item.id === updated.id ? updated : item)),
      updated
    };
  } catch (error) {
    return {
      items,
      error: error instanceof Error ? error.message : "Update failed"
    };
  }
}

type PendingAction = {
  user: AdminUser;
  patch: AdminUserPatch;
};

const statusOptions: AdminUserStatus[] = ["all", "active", "disabled", "admin"];

export function AdminAccountsTable({
  labels,
  locale,
  currentUserId
}: {
  labels: AdminLabels;
  locale: Locale;
  currentUserId?: string;
}) {
  const copy = labels.accounts;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<AdminUserStatus>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUsersPage | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [forbidden, setForbidden] = useState(false);
  const [pending, setPending] = useState<PendingAction | undefined>();
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<(AdminUser & { memberships?: AdminMembership[] }) | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    fetchAdminUsers({ q: debouncedQuery, status, page })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setForbidden(false);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        if (cause instanceof ApiError && cause.status === 403) {
          setForbidden(true);
          return;
        }
        setError(cause instanceof Error ? cause.message : copy.actionFailed);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.actionFailed, debouncedQuery, page, status]);

  useEffect(() => {
    if (!detailOpen || !detail?.id) {
      return;
    }
    let cancelled = false;
    const id = detail.id;
    setDetailLoading(true);
    setDetailError(undefined);

    fetchAdminUser(id)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setDetailError(cause instanceof Error ? cause.message : copy.actionFailed);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Only refetch when a different account is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detailOpen]);

  useEffect(() => {
    if (!pending && !detailOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPending(undefined);
        setDetailOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen, pending]);

  function openDetail(user: AdminUser) {
    setDetail(user);
    setDetailOpen(true);
  }

  async function applyPending() {
    if (!pending) {
      return;
    }
    const snapshot = data?.items ?? [];
    const { user, patch } = pending;
    setPending(undefined);
    setBusy(true);
    setActionError(undefined);
    setData((current) => (current ? { ...current, items: optimisticUserPatch(current.items, user.id, patch) } : current));

    const result = await runUserPatch(snapshot, user.id, patch);
    setData((current) => (current ? { ...current, items: result.items } : current));
    if (result.error) {
      setActionError(copy.actionFailed);
    } else if (result.updated) {
      setDetail((current) =>
        current && current.id === result.updated?.id ? { ...current, ...result.updated } : current
      );
    }
    setBusy(false);
  }

  if (forbidden) {
    return <AdminDenied labels={labels} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 md:max-w-sm">
          <span className="sr-only">{copy.searchPlaceholder}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={copy.searchPlaceholder}
            className="field h-10 min-h-10"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mute)]">
          <span className="mono-label">{copy.filterLabel}</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AdminUserStatus);
              setPage(1);
            }}
            className="field h-10 min-h-10 w-auto cursor-pointer pr-8"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {copy.status[option]}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-mono text-xs text-[var(--mute)]">
          {adminPageInfo(copy.pageInfo, page, totalPages, total)}
        </span>
      </div>

      {actionError ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-ink)]">
          {actionError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-ink)]">
          {error}
        </p>
      ) : null}

      <AdminTableShell>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--hairline)]">
                <th className="px-3 py-3 font-medium">{copy.columns.user}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.provider}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.role}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.status}</th>
                <th className="px-3 py-3 text-right font-medium">{copy.columns.workspaces}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.created}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.lastLogin}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-[var(--mute)]">
                    {copy.loading}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-[var(--mute)]">
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                items.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr
                      key={user.id}
                      onClick={() => openDetail(user)}
                      className="cursor-pointer border-b border-[var(--hairline)] transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-soft)]"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <AdminAvatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[var(--ink)]">{user.name}</span>
                            <span className="block truncate text-xs text-[var(--mute)]">{user.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="status-pill is-neutral">{labels.overview.charts[user.provider]}</span>
                      </td>
                      <td className="px-3 py-3">
                        {user.isPlatformAdmin ? <StatusPill tone="info">{copy.roleAdmin}</StatusPill> : <span className="text-[var(--ash)]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={user.disabled ? "danger" : "success"}>
                          {user.disabled ? copy.statusDisabled : copy.statusActive}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{user.workspaces}</td>
                      <td className="px-3 py-3 font-mono text-xs">{formatAdminDate(user.createdAt, locale, false)}</td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {user.lastLoginAt ? formatAdminDate(user.lastLoginAt, locale) : copy.never}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            disabled={isSelf || busy}
                            title={isSelf ? copy.selfHint : undefined}
                            onClick={() => setPending({ user, patch: { disabled: !user.disabled } })}
                            className="btn btn-ghost min-h-7 px-2 text-xs"
                          >
                            {user.disabled ? copy.unlock : copy.lock}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || busy}
                            title={isSelf ? copy.selfHint : undefined}
                            onClick={() => setPending({ user, patch: { isPlatformAdmin: !user.isPlatformAdmin } })}
                            className="btn btn-ghost min-h-7 px-2 text-xs"
                          >
                            {user.isPlatformAdmin ? copy.revokeAdmin : copy.grantAdmin}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} totalPages={totalPages} total={total} labels={copy} onPage={setPage} />
      </AdminTableShell>

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-[var(--ink)]/30" aria-hidden="true" onClick={() => setPending(undefined)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            className="card relative w-full max-w-sm p-5 shadow-[var(--shadow-md)]"
          >
            <h2 id="admin-confirm-title" className="text-base font-semibold text-[var(--ink)]">
              {copy.confirmTitle}
            </h2>
            <p className="mt-2 text-sm text-[var(--body)]">{copy.confirmBody.replace("{email}", pending.user.email)}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPending(undefined)} className="btn btn-secondary min-h-9 px-3">
                {copy.cancel}
              </button>
              <button type="button" onClick={() => void applyPending()} className="btn btn-primary min-h-9 px-3">
                {copy.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-[var(--ink)]/30" aria-hidden="true" onClick={() => setDetailOpen(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={copy.detailTitle}
            className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--hairline)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--ink)]">{copy.detailTitle}</h2>
              <button type="button" onClick={() => setDetailOpen(false)} className="btn btn-ghost min-h-8 px-2 text-sm">
                {copy.close}
              </button>
            </div>

            {detail ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <AdminAvatar name={detail.name} email={detail.email} avatarUrl={detail.avatarUrl} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--ink)]">{detail.name}</p>
                    <p className="truncate text-sm text-[var(--mute)]">{detail.email}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="status-pill is-neutral">{labels.overview.charts[detail.provider]}</span>
                  {detail.isPlatformAdmin ? <StatusPill tone="info">{copy.roleAdmin}</StatusPill> : null}
                  <StatusPill tone={detail.disabled ? "danger" : "success"}>
                    {detail.disabled ? copy.statusDisabled : copy.statusActive}
                  </StatusPill>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="mono-label">{copy.columns.created}</dt>
                    <dd className="mt-1">{formatAdminDate(detail.createdAt, locale, false)}</dd>
                  </div>
                  <div>
                    <dt className="mono-label">{copy.columns.lastLogin}</dt>
                    <dd className="mt-1">{detail.lastLoginAt ? formatAdminDate(detail.lastLoginAt, locale) : copy.never}</dd>
                  </div>
                </dl>

                <h3 className="mt-6 text-sm font-semibold text-[var(--ink)]">{copy.memberships}</h3>
                {detailLoading ? <p className="mt-2 text-sm text-[var(--mute)]">{copy.loading}</p> : null}
                {detailError ? (
                  <p role="alert" className="mt-2 text-sm text-[var(--danger-ink)]">
                    {detailError}
                  </p>
                ) : null}
                {detail.memberships && detail.memberships.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--mute)]">{copy.noMemberships}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-[var(--hairline)]">
                    {(detail.memberships ?? []).map((membership) => (
                      <li key={membership.workspaceId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--ink)]">{membership.workspaceName}</p>
                          <p className="text-xs text-[var(--mute)]">
                            {copy.joined} {formatAdminDate(membership.joinedAt, locale, false)}
                          </p>
                        </div>
                        <StatusPill tone="neutral">{membership.role}</StatusPill>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-[var(--mute)]">{copy.loading}</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
