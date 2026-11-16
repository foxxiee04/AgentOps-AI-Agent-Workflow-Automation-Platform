"use client";

import { apiUrl, refreshBrowserSession } from "../../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider?: "password" | "google";
};

export type AuthSession = {
  user: AuthUser;
};

const legacyStorageKey = "agentops.auth.v1";

function clearLegacyTokenStorage() {
  try {
    window.localStorage.removeItem(legacyStorageKey);
    document.cookie = "agentops_access_token=; Path=/; Max-Age=0; SameSite=Lax";
  } catch {
    // Storage or cookie access can be blocked; the legacy cleanup is best-effort.
  }
}

let currentUser: Promise<AuthUser | undefined> | undefined;

/** The API sets this non-HttpOnly hint whenever a session may exist; without it, there is nothing to probe. */
const sessionHintCookie = "agentops_session=1";

function hasSessionHint(): boolean {
  try {
    return document.cookie.split(";").some((cookie) => cookie.trim() === sessionHintCookie);
  } catch {
    return false;
  }
}

export function loadAuthUser(force = false): Promise<AuthUser | undefined> {
  clearLegacyTokenStorage();

  if (currentUser && !force) {
    return currentUser;
  }

  if (!hasSessionHint()) {
    return Promise.resolve(undefined);
  }

  const request = (async () => {
    const load = async (): Promise<{ status: number; user?: AuthUser }> => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include", cache: "no-store" });
        if (!response.ok) {
          return { status: response.status };
        }
        return { status: response.status, user: (await response.json()) as AuthUser };
      } catch {
        return { status: 0 };
      }
    };

    const first = await load();
    if (first.user) {
      return first.user;
    }

    if (first.status === 401 && (await refreshBrowserSession())) {
      return (await load()).user;
    }

    return undefined;
  })();

  currentUser = request;
  void request.then((user) => {
    if (!user && currentUser === request) {
      currentUser = undefined;
    }
  });

  return request;
}

export function setAuthUser(user: AuthUser | undefined) {
  currentUser = Promise.resolve(user);
  window.dispatchEvent(new Event("agentops-auth-change"));
}

export async function logout(): Promise<void> {
  clearLegacyTokenStorage();

  try {
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
  } catch {
    // Logging out locally still matters if the API is unreachable.
  }

  setAuthUser(undefined);
}

export async function authPost(path: string, body: Record<string, unknown>): Promise<AuthSession> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Auth request failed: ${response.status}`);
  }

  const session = (await response.json()) as AuthSession;
  return { user: session.user };
}

export function googleAuthHref(redirectTo: string) {
  return `${apiUrl}/auth/google?redirectTo=${encodeURIComponent(redirectTo)}`;
}
