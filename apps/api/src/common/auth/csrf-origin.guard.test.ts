import "reflect-metadata";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CsrfOriginGuard, csrfRejection } from "./csrf-origin.guard";

const env = { WEB_APP_URL: "http://localhost:3000" };
const originRejection = "Cross-site request blocked: origin not allowed";
const missingOriginRejection = "Cross-site request blocked: missing Origin header";

describe("csrfRejection", () => {
  it("allows a GET with a cookie and a foreign origin", () => {
    expect(
      csrfRejection({ method: "GET", path: "/workflows", headers: { cookie: "agentops_access=t", origin: "https://evil.example" } }, env)
    ).toBeUndefined();
  });

  it("allows a Bearer-authenticated POST from a foreign origin", () => {
    expect(
      csrfRejection(
        {
          method: "POST",
          path: "/workflows",
          headers: { authorization: "Bearer token", origin: "https://evil.example" }
        },
        env
      )
    ).toBeUndefined();
  });

  it("allows a cookie-authenticated POST from the web app origin", () => {
    expect(
      csrfRejection({ method: "POST", path: "/workflows", headers: { cookie: "agentops_access=t", origin: "http://localhost:3000" } }, env)
    ).toBeUndefined();
  });

  it("rejects a cookie-authenticated POST from a foreign origin", () => {
    expect(
      csrfRejection({ method: "POST", path: "/workflows", headers: { cookie: "agentops_access=t", origin: "https://evil.example" } }, env)
    ).toBe(originRejection);
  });

  it("rejects a cookie-authenticated POST with a null origin", () => {
    expect(csrfRejection({ method: "POST", path: "/workflows", headers: { cookie: "agentops_access=t", origin: "null" } }, env)).toBe(
      originRejection
    );
  });

  it("accepts a cookie-authenticated POST whose referer is the web app origin", () => {
    expect(
      csrfRejection(
        { method: "POST", path: "/workflows", headers: { cookie: "agentops_access=t", referer: "http://localhost:3000/workflows" } },
        env
      )
    ).toBeUndefined();
  });

  it("rejects a cookie-authenticated POST without origin or referer", () => {
    expect(csrfRejection({ method: "POST", path: "/workflows", headers: { cookie: "agentops_access=t" } }, env)).toBe(missingOriginRejection);
  });

  it("allows a cookie-less login without an origin", () => {
    expect(csrfRejection({ method: "POST", path: "/auth/login", headers: {} }, env)).toBeUndefined();
  });

  it("rejects an auth POST from a foreign origin even without cookies", () => {
    expect(csrfRejection({ method: "POST", path: "/auth/login", headers: { origin: "https://evil.example" } }, env)).toBe(originRejection);
  });

  it("allows an auth POST from the web app origin without cookies", () => {
    expect(csrfRejection({ method: "POST", path: "/auth/login", headers: { origin: "http://localhost:3000" } }, env)).toBeUndefined();
  });

  it("does not affect cookie-less webhooks", () => {
    expect(csrfRejection({ method: "POST", path: "/webhooks/leads", headers: { origin: "https://evil.example" } }, env)).toBeUndefined();
  });

  it("checks the url path without the query string when path is absent", () => {
    expect(
      csrfRejection({ method: "POST", url: "/auth/logout?x=1", headers: { cookie: "agentops_refresh=t" } }, env)
    ).toBe(missingOriginRejection);
  });
});

describe("CsrfOriginGuard", () => {
  it("throws ForbiddenException for a rejected request", () => {
    const request = {
      method: "POST",
      path: "/workflows",
      headers: { cookie: "agentops_access=t", origin: "https://evil.example" }
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request })
    } as unknown as ExecutionContext;

    expect(() => new CsrfOriginGuard().canActivate(context)).toThrow(ForbiddenException);
  });
});
