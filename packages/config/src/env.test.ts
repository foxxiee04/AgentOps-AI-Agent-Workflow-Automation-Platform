import { describe, expect, it } from "vitest";
import { parseAppEnv, parseKafkaBrokers } from "./env";

describe("parseKafkaBrokers", () => {
  it("splits comma separated brokers", () => {
    expect(parseKafkaBrokers("localhost:9094, kafka:9092")).toEqual(["localhost:9094", "kafka:9092"]);
  });
});


describe("parseAppEnv", () => {
  it("treats empty optional values copied from .env.example as unset", () => {
    const env = parseAppEnv({ ALERT_BOT_WEBHOOK_URL: "", OPENAI_API_KEY: "  ", AI_DAILY_CALL_LIMIT: "" });

    expect(env.ALERT_BOT_WEBHOOK_URL).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.AI_DAILY_CALL_LIMIT).toBeUndefined();
    expect(env.PORT).toBe(4000);
  });

  it("still rejects malformed values", () => {
    expect(() => parseAppEnv({ ALERT_BOT_WEBHOOK_URL: "not a url" })).toThrow();
  });

  it("accepts a valid DEMO_WORKSPACE_JOIN_ROLE and leaves it unset by default", () => {
    expect(parseAppEnv({}).DEMO_WORKSPACE_JOIN_ROLE).toBeUndefined();
    expect(parseAppEnv({ DEMO_WORKSPACE_JOIN_ROLE: "MEMBER" }).DEMO_WORKSPACE_JOIN_ROLE).toBe("MEMBER");
    expect(parseAppEnv({ DEMO_WORKSPACE_JOIN_ROLE: "" }).DEMO_WORKSPACE_JOIN_ROLE).toBeUndefined();
    expect(() => parseAppEnv({ DEMO_WORKSPACE_JOIN_ROLE: "SUPERUSER" })).toThrow();
  });
});
