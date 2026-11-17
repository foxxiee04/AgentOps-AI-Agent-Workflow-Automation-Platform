/**
 * Workspace helpers shared by server and client code. This module must stay free of "use client":
 * functions exported from a client module are client references and throw when a server component
 * calls them.
 */

export const WORKSPACE_COOKIE_NAME = "agentops_ws";
export const WORKSPACE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

/**
 * Resolves the active workspace from the user's workspaces and the cookie value.
 * Resolution order:
 * 1. Cookie value if it matches one of the user's workspaces
 * 2. Else the user's first workspace
 * 3. Else none (undefined)
 */
export function resolveActiveWorkspace<T extends { id: string }>(
  workspaces: T[] | undefined,
  cookieValue?: string | null
): T | undefined {
  if (!workspaces || workspaces.length === 0) {
    return undefined;
  }
  if (cookieValue) {
    const matched = workspaces.find((w) => w.id === cookieValue);
    if (matched) {
      return matched;
    }
  }
  return workspaces[0];
}
