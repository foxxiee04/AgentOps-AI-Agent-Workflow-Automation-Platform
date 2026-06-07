import { describe, expect, it } from "vitest";
import { kafkaTopics } from "./topics";

describe("kafkaTopics", () => {
  it("does not define duplicate topic names", () => {
    const topicNames = Object.values(kafkaTopics);
    expect(new Set(topicNames).size).toBe(topicNames.length);
  });
});
