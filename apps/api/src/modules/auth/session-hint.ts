import type { Response } from "express";
import { authCookieOptions, refreshCookieMaxAgeMs } from "../../common/auth/auth-cookies";

export const sessionHintCookieName = "agentops_session";
export const sessionHintCookieValue = "1";

/**
 * The hint is readable by the web app so it only probes `/auth/me` when a session may exist.
 * It carries no secret; the real tokens stay in HttpOnly cookies. It is scoped to `/` rather than
 * the refresh cookie's `/auth` path so the browser app can read it on any page.
 */
export function sessionHintCookieOptions(env: Record<string, string | undefined> = process.env) {
  return {
    ...authCookieOptions(env),
    httpOnly: false,
    path: "/",
    maxAge: refreshCookieMaxAgeMs
  };
}

export function setSessionHintCookie(response: Response, env: Record<string, string | undefined> = process.env): void {
  response.cookie(sessionHintCookieName, sessionHintCookieValue, sessionHintCookieOptions(env));
}

export function clearSessionHintCookie(response: Response, env: Record<string, string | undefined> = process.env): void {
  const { maxAge: _maxAge, ...options } = sessionHintCookieOptions(env);
  response.clearCookie(sessionHintCookieName, options);
}
