import { describe, expect, it, vi } from "vitest";
import {
  createEvent,
  idempotencyKeyFor,
  InMemoryProcessedMessageStore,
  kafkaTopics,
  NonRetryableError,
  processMessage,
  registerGracefulShutdown,
  type EventEnvelope
} from "./index";

const task = createEvent({
  type: kafkaTopics.agentTaskRequested,
  workspaceId: "ws_1",
  workflowId: "wf_1",
  workflowRunId: "run_1",
  payload: { nodeId: "ai-1", taskId: "task_1" }
});

function setup(handler: (event: EventEnvelope) => EventEnvelope[] | Promise<EventEnvelope[]>) {
  const published: EventEnvelope[] = [];
  const store = new InMemoryProcessedMessageStore();
  const run = (value = JSON.stringify(task)) =>
    processMessage({
      topic: kafkaTopics.agentTaskRequested,
      consumerGroup: "agentops.ai-worker",
      value,
      handler,
      publish: async (events) => {
        published.push(...events);
      },
      store,
      sleep: async () => undefined
    });
  return { published, store, run };
}

describe("processMessage", () => {
  it("keys idempotency by workflowRunId + nodeId + event type", () => {
    expect(idempotencyKeyFor(task)).toBe("run_1:ai-1:agent-task-requested");
  });

  it("publishes handler output once and skips redelivered duplicates", async () => {
    const handler = vi.fn(() => [
      createEvent({ type: kafkaTopics.agentTaskCompleted, workspaceId: "ws_1", workflowRunId: "run_1", payload: {} })
    ]);
    const { published, run } = setup(handler);

    expect((await run()).status).toBe("processed");
    // Same node redelivered with a new eventId is still a duplicate.
    expect((await run(JSON.stringify({ ...task, eventId: "evt_redelivered" }))).status).toBe("duplicate");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(published.map((event) => event.type)).toEqual([kafkaTopics.agentTaskCompleted]);
  });

  it("retries transient failures and succeeds", async () => {
    let calls = 0;
    const { run } = setup(() => {
      calls += 1;
      if (calls < 3) throw new Error("broker hiccup");
      return [];
    });

    expect(await run()).toMatchObject({ status: "processed", attempts: 3 });
  });

  it("dead-letters after 3 failed attempts and fails the step", async () => {
    const handler = vi.fn(() => {
      throw new Error("provider down");
    });
    const { published, store, run } = setup(handler);

    const outcome = await run();

    expect(outcome).toMatchObject({ status: "dead_lettered", attempts: 3, error: "provider down" });
    expect(handler).toHaveBeenCalledTimes(3);
    expect(published.map((event) => event.type)).toEqual([kafkaTopics.deadLetterEvents, kafkaTopics.workflowStepFailed]);
    expect(published[0]?.payload).toMatchObject({
      originalTopic: kafkaTopics.agentTaskRequested,
      reason: "retries_exhausted",
      attempts: 3
    });
    expect(published[1]?.payload).toMatchObject({ nodeId: "ai-1", message: "provider down" });
    expect(await store.isProcessed("agentops.ai-worker", "run_1:ai-1:agent-task-requested")).toBe(true);
  });

  it("does not retry non-retryable errors", async () => {
    const handler = vi.fn(() => {
      throw new NonRetryableError("AI output failed schema validation");
    });
    const { published, run } = setup(handler);

    expect(await run()).toMatchObject({ status: "dead_lettered", attempts: 1 });
    expect(published[0]?.payload).toMatchObject({ reason: "non_retryable" });
  });

  it("dead-letters messages that are not valid envelopes", async () => {
    const handler = vi.fn(() => []);
    const { published, run } = setup(handler);

    expect((await run("{not json")).status).toBe("dead_lettered");
    expect(handler).not.toHaveBeenCalled();
    expect(published[0]?.payload).toMatchObject({ reason: "invalid_envelope" });
  });
});

describe("registerGracefulShutdown", () => {
  it("stops the worker once and exits 0", async () => {
    const stop = vi.fn(async () => undefined);
    const exit = vi.fn();
    const shutdown = registerGracefulShutdown(stop, () => undefined, exit);

    shutdown("SIGTERM");
    shutdown("SIGINT");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("exits 1 when stopping fails", async () => {
    const exit = vi.fn();
    const shutdown = registerGracefulShutdown(async () => Promise.reject(new Error("broker gone")), () => undefined, exit);

    shutdown("SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });
});
