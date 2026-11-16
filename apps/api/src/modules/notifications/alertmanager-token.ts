import { timingSafeEqual } from "node:crypto";

/**
 * Validates the shared Bearer token Alertmanager sends to `/notifications/alertmanager`.
 * When no token is configured (e.g. the local compose stack), access is granted only
 * for `APP_ENV=local`; every other environment must configure a token.
 */
export function isAlertmanagerRequestAllowed(
  authorization: string | undefined,
  expectedToken: string | undefined,
  appEnv: string | undefined
): boolean {
  if (!expectedToken) {
    return appEnv === "local";
  }

  if (authorization === undefined) {
    return false;
  }

  const provided = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${expectedToken}`);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
