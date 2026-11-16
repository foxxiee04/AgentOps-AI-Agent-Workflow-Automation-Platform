import { describe, expect, it } from "vitest";
import { isAlertmanagerRequestAllowed } from "./alertmanager-token";

describe("isAlertmanagerRequestAllowed", () => {
  it("allows requests without a token in the local compose stack", () => {
    expect(isAlertmanagerRequestAllowed(undefined, undefined, "local")).toBe(true);
    expect(isAlertmanagerRequestAllowed("", "", "local")).toBe(true);
  });

  it("rejects requests without a configured token outside local", () => {
    expect(isAlertmanagerRequestAllowed(undefined, undefined, "production")).toBe(false);
    expect(isAlertmanagerRequestAllowed("Bearer something", "", "production")).toBe(false);
  });

  it("allows a request carrying the correct Bearer token", () => {
    expect(isAlertmanagerRequestAllowed("Bearer shared-secret", "shared-secret", "production")).toBe(true);
  });

  it("rejects a request carrying the wrong token", () => {
    expect(isAlertmanagerRequestAllowed("Bearer wrong-secret", "shared-secret", "production")).toBe(false);
  });

  it("rejects a missing authorization header when a token is expected", () => {
    expect(isAlertmanagerRequestAllowed(undefined, "shared-secret", "production")).toBe(false);
  });

  it("rejects a token of a different length", () => {
    expect(isAlertmanagerRequestAllowed("Bearer short", "a-much-longer-secret", "production")).toBe(false);
  });
});
