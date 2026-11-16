import { NotFoundException, type MessageEvent } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowsService } from "../workflows/workflows.service";
import { RunStreamService } from "./run-stream.service";

function setup(initialStatus = "RUNNING") {
  const state = { status: initialStatus, stepStatus: "PENDING" };
  const workflows = {
    findRun: vi.fn(async () => ({ id: "run_1", status: state.status })),
    stepsForRun: vi.fn(async () => ({
      workflowRunId: "run_1",
      steps: [{ id: "run_1_a", status: state.stepStatus }]
    }))
  };
  const service = new RunStreamService(workflows as unknown as WorkflowsService);
  return { state, workflows, service };
}

function collect(service: RunStreamService) {
  const events: MessageEvent[] = [];
  let completed = false;
  const subscription = service.stream("run_1", { pollMs: 1000, heartbeatMs: 15_000, maxMs: 60_000 }).subscribe({
    next: (event) => events.push(event),
    complete: () => {
      completed = true;
    }
  });
  return { events, subscription, isCompleted: () => completed };
}

describe("RunStreamService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits the first snapshot immediately", async () => {
    const { service } = setup();
    const { events, subscription } = collect(service);

    await vi.advanceTimersByTimeAsync(0);

    expect(events.map((event) => event.type)).toEqual(["snapshot"]);
    subscription.unsubscribe();
  });

  it("does not emit again while nothing changed, and emits when a step changes", async () => {
    const { service, state } = setup();
    const { events, subscription } = collect(service);

    await vi.advanceTimersByTimeAsync(3000);
    expect(events.filter((event) => event.type === "snapshot")).toHaveLength(1);

    state.stepStatus = "RUNNING";
    await vi.advanceTimersByTimeAsync(1000);
    expect(events.filter((event) => event.type === "snapshot")).toHaveLength(2);
    subscription.unsubscribe();
  });

  it("sends a ping every heartbeat interval", async () => {
    const { service } = setup();
    const { events, subscription } = collect(service);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(events.filter((event) => event.type === "ping")).toHaveLength(1);
    subscription.unsubscribe();
  });

  it("emits the final snapshot, an end event and completes when the run finishes", async () => {
    const { service, state } = setup();
    const { events, isCompleted } = collect(service);
    await vi.advanceTimersByTimeAsync(0);

    state.status = "COMPLETED";
    await vi.advanceTimersByTimeAsync(1000);

    expect(events.map((event) => event.type)).toEqual(["snapshot", "snapshot", "end"]);
    expect(events.at(-1)?.data).toEqual({ status: "COMPLETED" });
    expect(isCompleted()).toBe(true);
  });

  it("ends right away when the run is already finished", async () => {
    const { service } = setup("FAILED");
    const { events, isCompleted } = collect(service);

    await vi.advanceTimersByTimeAsync(0);

    expect(events.map((event) => event.type)).toEqual(["snapshot", "end"]);
    expect(isCompleted()).toBe(true);
  });

  it("clears all timers on unsubscribe", async () => {
    const { service, workflows } = setup();
    const { subscription } = collect(service);
    await vi.advanceTimersByTimeAsync(0);

    subscription.unsubscribe();

    expect(vi.getTimerCount()).toBe(0);
    const calls = workflows.findRun.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(workflows.findRun.mock.calls.length).toBe(calls);
  });

  it("skips a tick while a poll is still in flight", async () => {
    const { service, workflows } = setup();
    let release: () => void = () => undefined;
    workflows.findRun.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve({ id: "run_1", status: "RUNNING" })))
    );
    const { subscription } = collect(service);

    await vi.advanceTimersByTimeAsync(5000);
    expect(workflows.findRun).toHaveBeenCalledTimes(1);

    release();
    subscription.unsubscribe();
  });

  it("completes after the max duration", async () => {
    const { service } = setup();
    const { isCompleted } = collect(service);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(isCompleted()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("emits an error event and completes when the run is not found", async () => {
    const { service, workflows } = setup();
    workflows.findRun.mockRejectedValue(new NotFoundException("Workflow run not found"));
    const { events, isCompleted } = collect(service);

    await vi.advanceTimersByTimeAsync(0);

    expect(events).toEqual([{ type: "error", data: { message: "Workflow run not found" } }]);
    expect(isCompleted()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
