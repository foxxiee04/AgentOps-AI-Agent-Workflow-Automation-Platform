import { describe, expect, it, vi } from "vitest";
import {
  accessCookieMaxAgeMs,
  accessCookieName,
  authCookieOptions,
  clearAuthCookies,
  hasAuthCookie,
  isWebAppOrigin,
  readCookie,
  refreshCookieMaxAgeMs,
  refreshCookieName,
  refreshCookiePath,
  requestAuthorization,
  sessionResponseBody,
  setAuthCookies
} from "./auth-cookies";

const env = { APP_ENV: "local", WEB_APP_URL: "http://localhost:3000" };

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(readCookie({ cookie: "theme=dark; agentops_access=abc123; other=1" }, accessCookieName)).toBe("abc123");
  });

  it("decodes an encoded cookie value", () => {
    expect(readCookie({ cookie: "agentops_refresh=rfr_a%2Bb%3Dc" }, refreshCookieName)).toBe("rfr_a+b=c");
  });

  it("returns the raw value when percent-decoding fails", () => {
    expect(readCookie({ cookie: "agentops_access=100%zz" }, accessCookieName)).toBe("100%zz");
  });

  it("returns undefined for missing or empty cookies", () => {
    expect(readCookie({}, accessCookieName)).toBeUndefined();
    expect(readCookie({ cookie: "theme=dark" }, accessCookieName)).toBeUndefined();
    expect(readCookie({ cookie: "agentops_access=" }, accessCookieName)).toBeUndefined();
  });

  it("uses the first Cookie header when the header is repeated", () => {
    expect(readCookie({ cookie: ["agentops_access=first", "agentops_access=second"] }, accessCookieName)).toBe("first");
  });
});

describe("hasAuthCookie", () => {
  it("is true when either session cookie is present", () => {
    expect(hasAuthCookie({ cookie: "agentops_access=abc" })).toBe(true);
    expect(hasAuthCookie({ cookie: "agentops_refresh=def" })).toBe(true);
  });

  it("is false when no session cookie is present", () => {
    expect(hasAuthCookie({})).toBe(false);
    expect(hasAuthCookie({ cookie: "theme=dark" })).toBe(false);
  });
});

describe("requestAuthorization", () => {
  it("prefers the Authorization header over the access cookie", () => {
    expect(requestAuthorization({ authorization: "Bearer header", cookie: "agentops_access=cookie" })).toBe("Bearer header");
  });

  it("builds a Bearer value from the access cookie", () => {
    expect(requestAuthorization({ cookie: "agentops_access=tok" })).toBe("Bearer tok");
  });

  it("returns undefined without a header or access cookie", () => {
    expect(requestAuthorization({})).toBeUndefined();
    expect(requestAuthorization({ cookie: "agentops_refresh=only-refresh" })).toBeUndefined();
  });
});

describe("authCookieOptions", () => {
  it("is not secure for APP_ENV=local or an unset APP_ENV", () => {
    expect(authCookieOptions({ APP_ENV: "local" }).secure).toBe(false);
    expect(authCookieOptions({}).secure).toBe(false);
  });

  it("is secure for production", () => {
    expect(authCookieOptions({ APP_ENV: "production" })).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
  });

  it("sets the cookie domain from AUTH_COOKIE_DOMAIN", () => {
    expect(authCookieOptions({ AUTH_COOKIE_DOMAIN: " .example.com " }).domain).toBe(".example.com");
    expect(authCookieOptions({ AUTH_COOKIE_DOMAIN: "  " }).domain).toBeUndefined();
  });
});

describe("isWebAppOrigin", () => {
  it("matches the configured web app origin", () => {
    expect(isWebAppOrigin({ origin: "http://localhost:3000" }, env)).toBe(true);
    expect(isWebAppOrigin({ origin: "http://localhost:3000" }, { WEB_APP_URL: "https://app.example.com" })).toBe(false);
    expect(isWebAppOrigin({}, env)).toBe(false);
  });
});

describe("sessionResponseBody", () => {
  const session = { user: { id: "user_1" }, accessToken: "access", refreshToken: "refresh" };

  it("returns only the user for the web app origin", () => {
    expect(sessionResponseBody(session, { origin: "http://localhost:3000" }, env)).toEqual({ user: session.user });
  });

  it("returns the full session without an origin or for another origin", () => {
    expect(sessionResponseBody(session, {}, env)).toEqual(session);
    expect(sessionResponseBody(session, { origin: "http://localhost:4000" }, env)).toEqual(session);
  });
});

describe("setAuthCookies", () => {
  it("sets HttpOnly access and refresh cookies", () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    setAuthCookies(response as never, { accessToken: "access", refreshToken: "refresh" }, env);

    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(response.cookie).toHaveBeenNthCalledWith(1, accessCookieName, "access", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      domain: undefined,
      path: "/",
      maxAge: accessCookieMaxAgeMs
    });
    expect(response.cookie).toHaveBeenNthCalledWith(2, refreshCookieName, "refresh", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      domain: undefined,
      path: refreshCookiePath,
      maxAge: refreshCookieMaxAgeMs
    });
  });
});

describe("clearAuthCookies", () => {
  it("clears both cookies with the same attributes and paths", () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    clearAuthCookies(response as never, { APP_ENV: "production", AUTH_COOKIE_DOMAIN: ".example.com" });

    expect(response.clearCookie).toHaveBeenCalledTimes(2);
    expect(response.clearCookie).toHaveBeenNthCalledWith(1, accessCookieName, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      domain: ".example.com",
      path: "/"
    });
    expect(response.clearCookie).toHaveBeenNthCalledWith(2, refreshCookieName, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      domain: ".example.com",
      path: refreshCookiePath
    });
  });
});
