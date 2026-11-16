import { describe, expect, it } from "vitest";
import { assertLocalDatabase } from "./safety";

const localUrl = "postgresql://agentops:agentops@localhost:55432/agentops";

describe("assertLocalDatabase", () => {
  it("allows the local compose database", () => {
    expect(assertLocalDatabase(localUrl, {}).hostname).toBe("localhost");
    expect(assertLocalDatabase("postgresql://a:b@postgres:5432/agentops", { APP_ENV: "local" }).hostname).toBe("postgres");
  });

  it.each([
    ["remote host", "postgresql://a:b@agentops.abc123.eu-west-1.rds.amazonaws.com:5432/agentops", {}],
    ["missing url", undefined, {}],
    ["non-local APP_ENV", localUrl, { APP_ENV: "staging" }],
    ["production NODE_ENV", localUrl, { NODE_ENV: "production" }]
  ] as const)("refuses %s", (_case, url, env) => {
    expect(() => assertLocalDatabase(url, env)).toThrow(/Refusing to reset/);
  });
});
