import { describe, expect, it, vi } from "vitest";
import { refreshCookieMaxAgeMs } from "../../common/auth/auth-cookies";
import {
  clearSessionHintCookie,
  sessionHintCookieName,
  sessionHintCookieValue,
  setSessionHintCookie
} from "./session-hint";

const env = { APP_ENV: "local" };

describe("setSessionHintCookie", () => {
  it("sets a readable session hint that lives as long as the refresh cookie", () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    setSessionHintCookie(response as never, env);

    expect(response.cookie).toHaveBeenCalledTimes(1);
    expect(response.cookie).toHaveBeenCalledWith(sessionHintCookieName, sessionHintCookieValue, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      domain: undefined,
      path: "/",
      maxAge: refreshCookieMaxAgeMs
    });
  });

  it("follows the configured secure flag and cookie domain", () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    setSessionHintCookie(response as never, { APP_ENV: "production", AUTH_COOKIE_DOMAIN: ".example.com" });

    expect(response.cookie).toHaveBeenCalledWith(
      sessionHintCookieName,
      sessionHintCookieValue,
      expect.objectContaining({ httpOnly: false, secure: true, domain: ".example.com", path: "/" })
    );
  });
});

describe("clearSessionHintCookie", () => {
  it("clears the hint cookie with the same attributes and path", () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    clearSessionHintCookie(response as never, env);

    expect(response.clearCookie).toHaveBeenCalledTimes(1);
    expect(response.clearCookie).toHaveBeenCalledWith(sessionHintCookieName, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      domain: undefined,
      path: "/"
    });
  });
});
