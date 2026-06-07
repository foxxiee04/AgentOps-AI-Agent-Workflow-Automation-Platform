"use client";

import { apiUrl } from "../../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider?: "password" | "google";
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

const storageKey = "agentops.auth.v1";

export function readAuthSession(): AuthSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return undefined;
  }
}

export function saveAuthSession(session: AuthSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
  window.dispatchEvent(new Event("agentops-auth-change"));
}

export function clearAuthSession() {
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event("agentops-auth-change"));
}

export function accessToken() {
  return readAuthSession()?.accessToken;
}

export async function authPost(path: string, body: Record<string, unknown>): Promise<AuthSession> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Auth request failed: ${response.status}`);
  }

  return response.json() as Promise<AuthSession>;
}

export function googleAuthHref(redirectTo: string) {
  return `${apiUrl}/auth/google?redirectTo=${encodeURIComponent(redirectTo)}`;
}
