import type { Response } from "express";

export const accessCookieName = "agentops_access";
export const refreshCookieName = "agentops_refresh";
/** The refresh cookie is only sent to the API's /auth routes. */
export const refreshCookiePath = "/auth";
export const accessCookieMaxAgeMs = 15 * 60_000;
export const refreshCookieMaxAgeMs = 30 * 24 * 60 * 60_000;

type HeaderBag = Record<string, string | string[] | undefined>;
type Env = Record<string, string | undefined>;

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads a cookie value from a request's Cookie header, tolerating malformed percent-encoding. */
export function readCookie(headers: HeaderBag, name: string): string | undefined {
  const header = firstHeaderValue(headers.cookie);
  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    if (trimmed.slice(0, separator).trim() !== name) {
      continue;
    }

    const rawValue = trimmed.slice(separator + 1);
    try {
      return decodeURIComponent(rawValue) || undefined;
    } catch {
      return rawValue || undefined;
    }
  }

  return undefined;
}

/** True when the request carries either of the session cookies. */
export function hasAuthCookie(headers: HeaderBag): boolean {
  return readCookie(headers, accessCookieName) !== undefined || readCookie(headers, refreshCookieName) !== undefined;
}

/** Returns the Authorization value from the header (which wins) or the access cookie. */
export function requestAuthorization(headers: HeaderBag): string | undefined {
  const header = firstHeaderValue(headers.authorization);
  if (header) {
    return header;
  }

  const cookie = readCookie(headers, accessCookieName);
  return cookie ? `Bearer ${cookie}` : undefined;
}

/** Shared cookie attributes; cookies are only `secure` outside local development. */
export function authCookieOptions(env: Env = process.env) {
  return {
    httpOnly: true,
    secure: (env.APP_ENV ?? "local") !== "local",
    sameSite: "lax" as const,
    domain: env.AUTH_COOKIE_DOMAIN?.trim() || undefined
  };
}

/** Sets the HttpOnly access and refresh cookies for a new session. */
export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  env: Env = process.env
): void {
  response.cookie(accessCookieName, tokens.accessToken, {
    ...authCookieOptions(env),
    path: "/",
    maxAge: accessCookieMaxAgeMs
  });
  response.cookie(refreshCookieName, tokens.refreshToken, {
    ...authCookieOptions(env),
    path: refreshCookiePath,
    maxAge: refreshCookieMaxAgeMs
  });
}

/** Clears the HttpOnly session cookies on logout. */
export function clearAuthCookies(response: Response, env: Env = process.env): void {
  const options = authCookieOptions(env);
  response.clearCookie(accessCookieName, { ...options, path: "/" });
  response.clearCookie(refreshCookieName, { ...options, path: refreshCookiePath });
}

/** True when the request comes from the configured web app origin. */
export function isWebAppOrigin(headers: HeaderBag, env: Env = process.env): boolean {
  const origin = firstHeaderValue(headers.origin);
  if (!origin) {
    return false;
  }

  return origin === new URL(env.WEB_APP_URL ?? "http://localhost:3000").origin;
}

/**
 * Hides the tokens from the browser app, which receives them only as HttpOnly cookies,
 * while non-browser clients (Postman, k6, integration tests) still get them in JSON.
 */
export function sessionResponseBody<T extends { user: unknown; accessToken: string; refreshToken: string }>(
  session: T,
  headers: HeaderBag,
  env: Env = process.env
): { user: T["user"] } | T {
  return isWebAppOrigin(headers, env) ? { user: session.user } : session;
}
