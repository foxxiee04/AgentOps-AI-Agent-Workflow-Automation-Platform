import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "./api";
import { apiGet } from "./server-api";
import type { AuthUser, AuthWorkspace } from "../features/auth/auth-client";
import { resolveActiveWorkspace, WORKSPACE_COOKIE_MAX_AGE, WORKSPACE_COOKIE_NAME } from "./workspace-shared";

export { resolveActiveWorkspace, WORKSPACE_COOKIE_NAME, WORKSPACE_COOKIE_MAX_AGE };

export type ActiveWorkspaceResult = {
  workspaces: AuthWorkspace[];
  active?: AuthWorkspace;
};

/**
 * Server-side active workspace resolution.
 * Reads the `agentops_ws` cookie, calls `GET /auth/me` forwarding incoming cookies,
 * and derives the active workspace according to resolution order.
 * Cached per request via React `cache()`.
 */
export const getActiveWorkspace = cache(async (): Promise<ActiveWorkspaceResult> => {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
    const user = await apiGet<AuthUser>("/auth/me");
    const workspaces = user.workspaces ?? [];
    const active = resolveActiveWorkspace(workspaces, cookieValue);
    return { workspaces, active };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    return { workspaces: [], active: undefined };
  }
});
