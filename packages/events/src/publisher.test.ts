import { describe, expect, it, vi } from "vitest";
import { createEvent, createEventPublisher, kafkaTopics } from "./index";

describe("createEventPublisher", () => {
  it("sends all events of one handled message in a single batch, grouped by topic and keyed by run", async () => {
    const sendBatch = vi.fn(async () => []);
    const kafka = { producer: () => ({ connect: vi.fn(async () => undefined), disconnect: vi.fn(), sendBatch }) };
    const publisher = await createEventPublisher(kafka as never);
    const base = { workspaceId: "ws", workflowRunId: "run_1" };

    await publisher.publish([
      createEvent({ ...base, type: kafkaTopics.workflowStepStarted, payload: { nodeId: "a" } }),
      createEvent({ ...base, type: kafkaTopics.agentTaskRequested, payload: { nodeId: "ai-1" } }),
      createEvent({ ...base, type: kafkaTopics.workflowStepStarted, payload: { nodeId: "b" } })
    ]);
    await publisher.publish([]);

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const [{ topicMessages }] = sendBatch.mock.calls[0] as unknown as [{ topicMessages: Array<{ topic: string; messages: Array<{ key: string; value: string }> }> }];
    expect(topicMessages.map((group) => group.topic)).toEqual([kafkaTopics.workflowStepStarted, kafkaTopics.agentTaskRequested]);
    expect(topicMessages[0]?.messages.map((message) => JSON.parse(message.value).payload.nodeId)).toEqual(["a", "b"]);
    expect(topicMessages[0]?.messages[0]?.key).toBe("run_1");
  });
});
