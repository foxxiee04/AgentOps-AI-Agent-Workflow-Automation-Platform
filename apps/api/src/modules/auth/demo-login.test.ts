import { describe, expect, it } from "vitest";
import { isDemoLoginEnabled } from "./demo-login";

describe("isDemoLoginEnabled", () => {
  it("defaults to enabled when unset and APP_ENV is local", () => {
    expect(isDemoLoginEnabled({ APP_ENV: "local" })).toBe(true);
  });

  it("defaults to enabled when unset and APP_ENV is absent", () => {
    expect(isDemoLoginEnabled({})).toBe(true);
  });

  it("defaults to disabled when unset and APP_ENV is dev", () => {
    expect(isDemoLoginEnabled({ APP_ENV: "dev" })).toBe(false);
  });

  it("defaults to disabled when unset and APP_ENV is prod", () => {
    expect(isDemoLoginEnabled({ APP_ENV: "prod" })).toBe(false);
  });

  it("is enabled when DEMO_LOGIN_ENABLED is true even in prod", () => {
    expect(isDemoLoginEnabled({ DEMO_LOGIN_ENABLED: "true", APP_ENV: "prod" })).toBe(true);
  });

  it("is disabled when DEMO_LOGIN_ENABLED is false even in local", () => {
    expect(isDemoLoginEnabled({ DEMO_LOGIN_ENABLED: "false", APP_ENV: "local" })).toBe(false);
  });
});
