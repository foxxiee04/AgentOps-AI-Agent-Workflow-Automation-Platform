"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import type { Locale } from "../../lib/i18n";
import { fetchAdminWorkspaces } from "./api";
import { AdminDenied, AdminPagination, AdminTableShell, adminPageInfo, formatAdminDate, formatAdminNumber, type AdminLabels } from "./admin-ui";
import type { AdminWorkspacesPage } from "./schemas";

export function AdminWorkspacesTable({ labels, locale }: { labels: AdminLabels; locale: Locale }) {
  const copy = labels.workspaces;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminWorkspacesPage | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    fetchAdminWorkspaces({ q: debouncedQuery, page })
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
        setError(cause instanceof Error ? cause.message : copy.empty);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.empty, debouncedQuery, page]);

  if (forbidden) {
    return <AdminDenied labels={labels} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, data?.pageSize ?? 20)));

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
        <span className="ml-auto font-mono text-xs text-[var(--mute)]">
          {adminPageInfo(copy.pageInfo, page, totalPages, total)}
        </span>
      </div>

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
                <th className="px-3 py-3 font-medium">{copy.columns.name}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.slug}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.owner}</th>
                <th className="px-3 py-3 text-right font-medium">{copy.columns.members}</th>
                <th className="px-3 py-3 text-right font-medium">{copy.columns.workflows}</th>
                <th className="px-3 py-3 text-right font-medium">{copy.columns.runs}</th>
                <th className="px-3 py-3 text-right font-medium">{copy.columns.tokens}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.created}</th>
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
                items.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-[var(--hairline)] transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-soft)]">
                    <td className="px-3 py-3 font-medium text-[var(--ink)]">{workspace.name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--mute)]">{workspace.slug}</td>
                    <td className="px-3 py-3">{workspace.ownerEmail}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatAdminNumber(workspace.members, locale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatAdminNumber(workspace.workflows, locale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatAdminNumber(workspace.runs, locale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatAdminNumber(workspace.aiTokens, locale)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{formatAdminDate(workspace.createdAt, locale, false)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} totalPages={totalPages} total={total} labels={copy} onPage={setPage} />
      </AdminTableShell>
    </div>
  );
}
