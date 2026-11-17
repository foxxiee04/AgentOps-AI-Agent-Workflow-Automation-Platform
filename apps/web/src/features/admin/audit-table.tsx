"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import type { Locale } from "../../lib/i18n";
import { fetchAdminAudit } from "./api";
import { AdminDenied, AdminPagination, AdminTableShell, adminPageInfo, formatAdminDate, type AdminLabels } from "./admin-ui";
import type { AdminAuditPage } from "./schemas";

function shortJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function AdminAuditTable({ labels, locale }: { labels: AdminLabels; locale: Locale }) {
  const copy = labels.audit;
  const [action, setAction] = useState("");
  const [debouncedAction, setDebouncedAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminAuditPage | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAction(action.trim()), 300);
    return () => clearTimeout(timer);
  }, [action]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    fetchAdminAudit({ action: debouncedAction, page })
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
  }, [copy.empty, debouncedAction, page]);

  if (forbidden) {
    return <AdminDenied labels={labels} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, data?.pageSize ?? 30)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 md:max-w-sm">
          <span className="sr-only">{copy.filterPlaceholder}</span>
          <input
            type="search"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            placeholder={copy.filterPlaceholder}
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
                <th className="px-3 py-3 font-medium">{copy.columns.time}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.actor}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.action}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.entity}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.workspace}</th>
                <th className="px-3 py-3 font-medium">{copy.columns.metadata}</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-[var(--mute)]">
                    {copy.loading}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-[var(--mute)]">
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                items.map((entry) => {
                  const json = shortJson(entry.metadata);
                  return (
                    <tr key={entry.id} className="border-b border-[var(--hairline)] align-top transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-soft)]">
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{formatAdminDate(entry.createdAt, locale)}</td>
                      <td className="px-3 py-3">{entry.actorEmail ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className="status-pill is-neutral">{entry.action}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        <span className="text-[var(--body)]">{entry.entityType}</span>
                        {entry.entityId ? <span className="text-[var(--mute)]"> · {entry.entityId}</span> : null}
                      </td>
                      <td className="px-3 py-3">{entry.workspaceName ?? "—"}</td>
                      <td className="px-3 py-3">
                        <details className="group max-w-[260px]">
                          <summary className="cursor-pointer list-none font-mono text-xs text-[var(--accent)] underline decoration-[var(--hairline-strong)] underline-offset-4">
                            {json === "—" ? json : `${json.slice(0, 48)}${json.length > 48 ? "…" : ""}`}
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded-[6px] bg-[var(--surface-soft)] p-2 font-mono text-[11px] leading-relaxed text-[var(--body)]">
                            {json}
                          </pre>
                        </details>
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
    </div>
  );
}
