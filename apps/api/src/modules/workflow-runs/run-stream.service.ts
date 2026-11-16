import { Inject, Injectable, type MessageEvent } from "@nestjs/common";
import { isRunActive, type WorkflowRunStepsView } from "@agentops/shared";
import { Observable } from "rxjs";
import { WorkflowsService } from "../workflows/workflows.service";

export type RunStreamOptions = {
  pollMs?: number;
  heartbeatMs?: number;
  maxMs?: number;
};

const DEFAULT_POLL_MS = 1000;
const DEFAULT_HEARTBEAT_MS = 15_000;
const DEFAULT_MAX_MS = 30 * 60 * 1000;

type RunSnapshot = { status: string; startedAt?: string; finishedAt?: string; errorMessage?: string };

function fingerprint(run: RunSnapshot, steps: WorkflowRunStepsView) {
  return JSON.stringify([
    run.status,
    run.startedAt,
    run.finishedAt,
    run.errorMessage,
    steps.steps.map((step) => [step.id, step.status, step.finishedAt])
  ]);
}

/** Pushes run + step snapshots over SSE by polling the database, so it works with any number of API replicas. */
@Injectable()
export class RunStreamService {
  constructor(@Inject(WorkflowsService) private readonly workflowsService: WorkflowsService) {}

  stream(runId: string, options: RunStreamOptions = {}): Observable<MessageEvent> {
    const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    const maxMs = options.maxMs ?? DEFAULT_MAX_MS;

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      let inFlight = false;
      let lastFingerprint: string | undefined;

      const poll = async () => {
        if (closed || inFlight) {
          return;
        }
        inFlight = true;
        try {
          const [run, steps] = await Promise.all([
            this.workflowsService.findRun(runId),
            this.workflowsService.stepsForRun(runId)
          ]);
          if (closed) {
            return;
          }

          const current = fingerprint(run, steps);
          if (current !== lastFingerprint) {
            lastFingerprint = current;
            subscriber.next({ type: "snapshot", data: { run, steps } });
          }
          if (!isRunActive(run.status)) {
            subscriber.next({ type: "end", data: { status: run.status } });
            subscriber.complete();
          }
        } catch (error) {
          if (!closed) {
            subscriber.next({
              type: "error",
              data: { message: error instanceof Error ? error.message : "Run stream failed" }
            });
            subscriber.complete();
          }
        } finally {
          inFlight = false;
        }
      };

      const pollTimer = setInterval(() => void poll(), pollMs);
      const heartbeatTimer = setInterval(() => {
        if (!closed) {
          subscriber.next({ type: "ping", data: "" });
        }
      }, heartbeatMs);
      const maxTimer = setTimeout(() => subscriber.complete(), maxMs);

      void poll();

      return () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(maxTimer);
      };
    });
  }
}
