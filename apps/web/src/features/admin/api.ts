import { apiUrl, clientApiGet, readError, refreshBrowserSession } from "../../lib/api";
import {
  adminAuditPageSchema,
  adminUserDetailSchema,
  adminUserSchema,
  adminUsersPageSchema,
  adminWorkspacesPageSchema,
  type AdminAuditPage,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserPatch,
  type AdminUsersPage,
  type AdminWorkspacesPage
} from "./schemas";

export const ADMIN_PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 30;

export type AdminUserStatus = "all" | "active" | "disabled" | "admin";
export type AdminReportType = "users" | "workspaces" | "runs" | "usage";

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export function fetchAdminUsers(params: {
  q?: string;
  status?: AdminUserStatus;
  page?: number;
  pageSize?: number;
}): Promise<AdminUsersPage> {
  const query = buildQuery({
    q: params.q?.trim(),
    status: params.status && params.status !== "all" ? params.status : undefined,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? ADMIN_PAGE_SIZE
  });
  return clientApiGet(`/admin/users?${query}`, adminUsersPageSchema);
}

export function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  return clientApiGet(`/admin/users/${encodeURIComponent(id)}`, adminUserDetailSchema);
}

export function fetchAdminWorkspaces(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminWorkspacesPage> {
  const query = buildQuery({
    q: params.q?.trim(),
    page: params.page ?? 1,
    pageSize: params.pageSize ?? ADMIN_PAGE_SIZE
  });
  return clientApiGet(`/admin/workspaces?${query}`, adminWorkspacesPageSchema);
}

export function fetchAdminAudit(params: {
  action?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminAuditPage> {
  const query = buildQuery({
    action: params.action?.trim(),
    page: params.page ?? 1,
    pageSize: params.pageSize ?? AUDIT_PAGE_SIZE
  });
  return clientApiGet(`/admin/audit?${query}`, adminAuditPageSchema);
}

async function patchWithSession(path: string, body: Record<string, unknown>): Promise<AdminUser> {
  const init: RequestInit = {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };

  let response = await fetch(`${apiUrl}${path}`, init);
  if (response.status === 401 && (await refreshBrowserSession())) {
    response = await fetch(`${apiUrl}${path}`, init);
  }

  if (!response.ok) {
    throw await readError(response);
  }

  return adminUserSchema.parse(await response.json());
}

export function updateAdminUser(id: string, patch: AdminUserPatch): Promise<AdminUser> {
  return patchWithSession(`/admin/users/${encodeURIComponent(id)}`, patch);
}

/**
 * CSV download URL. The browser hits the API directly with the session cookie; the API sets
 * Content-Disposition: attachment, so the anchor only needs `download` as a hint.
 */
export function adminReportHref(type: AdminReportType, days: number, base: string = apiUrl): string {
  return `${base.replace(/\/$/, "")}/admin/reports/${type}.csv?days=${days}`;
}
