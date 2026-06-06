import { describe, expect, it } from "vitest";
import { parseKafkaBrokers } from "./env";

describe("parseKafkaBrokers", () => {
  it("splits comma separated brokers", () => {
    expect(parseKafkaBrokers("localhost:9094, kafka:9092")).toEqual(["localhost:9094", "kafka:9092"]);
  });
});

