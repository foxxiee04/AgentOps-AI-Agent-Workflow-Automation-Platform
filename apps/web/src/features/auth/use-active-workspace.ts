"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAuthUser, type AuthUser, type AuthWorkspace } from "./auth-client";

import { resolveActiveWorkspace, WORKSPACE_COOKIE_MAX_AGE, WORKSPACE_COOKIE_NAME } from "../../lib/workspace-shared";

export { resolveActiveWorkspace, WORKSPACE_COOKIE_MAX_AGE, WORKSPACE_COOKIE_NAME };

export function getWorkspaceCookie(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  try {
    const parts = document.cookie.split(";");
    for (const part of parts) {
      const [name, ...rest] = part.trim().split("=");
      if (name === WORKSPACE_COOKIE_NAME) {
        return decodeURIComponent(rest.join("="));
      }
    }
  } catch {
    // Cookie access can fail in sandboxes or restricted environments.
  }
  return undefined;
}

export function setWorkspaceCookie(workspaceId: string): void {
  if (typeof document === "undefined") {
    return;
  }
  try {
    document.cookie = `${WORKSPACE_COOKIE_NAME}=${encodeURIComponent(workspaceId)}; Path=/; Max-Age=${WORKSPACE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // Cookie access can fail in sandboxes or restricted environments.
  }
}

let activeRouter: { refresh: () => void } | undefined;

export function setActiveWorkspace(id: string, router?: { refresh: () => void }): void {
  setWorkspaceCookie(id);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("agentops-workspace-change"));
  }
  if (router) {
    router.refresh();
  } else if (activeRouter) {
    activeRouter.refresh();
  }
}

export function useActiveWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | undefined>();
  const [cookieWs, setCookieWs] = useState<string | undefined>(() => getWorkspaceCookie());

  useEffect(() => {
    activeRouter = router;
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    function sync() {
      setCookieWs(getWorkspaceCookie());
      void loadAuthUser().then((nextUser) => {
        if (!cancelled) {
          setUser(nextUser);
        }
      });
    }

    sync();
    window.addEventListener("agentops-auth-change", sync);
    window.addEventListener("agentops-workspace-change", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("agentops-auth-change", sync);
      window.removeEventListener("agentops-workspace-change", sync);
    };
  }, []);

  const workspaces: AuthWorkspace[] = user?.workspaces ?? [];
  const active = resolveActiveWorkspace(workspaces, cookieWs);

  const switchWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspace(id, router);
    },
    [router]
  );

  return {
    workspaces,
    active,
    setActiveWorkspace: switchWorkspace,
    user
  };
}
