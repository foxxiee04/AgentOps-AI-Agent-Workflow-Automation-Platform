import { describe, expect, it } from "vitest";
import { resolveTrustProxy } from "./trust-proxy";

describe("resolveTrustProxy", () => {
  it("disables proxy trust when unset", () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
  });

  it("disables proxy trust for an explicit zero", () => {
    expect(resolveTrustProxy("0")).toBe(false);
  });

  it("returns the configured hop count", () => {
    expect(resolveTrustProxy("1")).toBe(1);
    expect(resolveTrustProxy("2")).toBe(2);
  });

  it("rejects true because that would trust every hop", () => {
    expect(() => resolveTrustProxy("true")).toThrow("API_TRUST_PROXY must be a hop count");
  });

  it("rejects negative hop counts", () => {
    expect(() => resolveTrustProxy("-1")).toThrow("API_TRUST_PROXY must be a hop count");
  });
});
