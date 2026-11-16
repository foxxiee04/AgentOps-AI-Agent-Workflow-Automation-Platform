import { createEvent, traceContextFromEvent } from "./factory";
import { eventEnvelopeSchema, type EventEnvelope } from "./envelope";
import { kafkaTopics } from "./topics";

/** Remembers which messages a consumer group already handled (at-least-once delivery → exactly-once effects). */
export interface ProcessedMessageStore {
  isProcessed(consumerGroup: string, idempotencyKey: string): Promise<boolean>;
  markProcessed(consumerGroup: string, idempotencyKey: string, eventId: string, outcome: string): Promise<void>;
}

/** Throw this from a handler when retrying cannot help (invalid AI output, quota exceeded, bad config). */
export class NonRetryableError extends Error {
  override readonly name = "NonRetryableError";
}

export type MessageOutcome = {
  status: "processed" | "duplicate" | "dead_lettered";
  attempts: number;
  idempotencyKey?: string;
  event?: EventEnvelope;
  error?: string;
};

export type ProcessMessageOptions = {
  topic: string;
  consumerGroup: string;
  value: string;
  handler: (event: EventEnvelope) => Promise<EventEnvelope[]> | EventEnvelope[];
  publish: (events: EventEnvelope[]) => Promise<void>;
  store: ProcessedMessageStore;
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
};

export const DEFAULT_MAX_ATTEMPTS = 3;

/** `workflowRunId:nodeId:eventType` — the idempotency key used by every worker. */
export function idempotencyKeyFor(event: EventEnvelope): string {
  const nodeId = typeof event.payload["nodeId"] === "string" ? event.payload["nodeId"] : "run";
  return `${event.workflowRunId}:${nodeId}:${event.type}`;
}

/**
 * Handles one Kafka message: skips duplicates, retries the handler up to `maxAttempts`, publishes
 * the handler's events, and after the last failed attempt sends the message to `dead-letter-events`
 * (plus `workflow-step-failed` when the message belongs to a node) so the run does not hang.
 * Never throws for handler errors, so the offset can be committed.
 */
export async function processMessage(options: ProcessMessageOptions): Promise<MessageOutcome> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const backoffMs = options.backoffMs ?? ((attempt: number) => 200 * 2 ** (attempt - 1));

  let event: EventEnvelope;
  try {
    event = eventEnvelopeSchema.parse(JSON.parse(options.value));
  } catch (error) {
    await options.publish([
      createEvent({
        type: kafkaTopics.deadLetterEvents,
        workspaceId: "unknown",
        workflowRunId: "unknown",
        payload: {
          originalTopic: options.topic,
          consumerGroup: options.consumerGroup,
          reason: "invalid_envelope",
          error: errorMessage(error),
          rawValue: options.value.slice(0, 4_000)
        }
      })
    ]);
    return { status: "dead_lettered", attempts: 0, error: errorMessage(error) };
  }

  const idempotencyKey = idempotencyKeyFor(event);
  if (await options.store.isProcessed(options.consumerGroup, idempotencyKey)) {
    return { status: "duplicate", attempts: 0, idempotencyKey, event };
  }

  let lastError: unknown;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const outputs = await options.handler(event);
      await options.publish(outputs);
      await options.store.markProcessed(options.consumerGroup, idempotencyKey, event.eventId, "processed");
      return { status: "processed", attempts, idempotencyKey, event };
    } catch (error) {
      lastError = error;
      if (error instanceof NonRetryableError) {
        break;
      }
      if (attempts < maxAttempts) {
        await sleep(backoffMs(attempts));
      }
    }
  }

  await options.publish(deadLetterEvents(event, options, attempts, lastError));
  await options.store.markProcessed(options.consumerGroup, idempotencyKey, event.eventId, "dead_lettered");
  return { status: "dead_lettered", attempts, idempotencyKey, event, error: errorMessage(lastError) };
}

function deadLetterEvents(
  event: EventEnvelope,
  options: Pick<ProcessMessageOptions, "topic" | "consumerGroup">,
  attempts: number,
  error: unknown
): EventEnvelope[] {
  const base = {
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    ...traceContextFromEvent(event)
  };
  const events: EventEnvelope[] = [
    createEvent({
      ...base,
      type: kafkaTopics.deadLetterEvents,
      payload: {
        originalTopic: options.topic,
        consumerGroup: options.consumerGroup,
        reason: error instanceof NonRetryableError ? "non_retryable" : "retries_exhausted",
        attempts,
        error: errorMessage(error),
        originalEvent: event
      }
    })
  ];

  const nodeId = event.payload["nodeId"];
  // A failed step must fail the run; the workflow-worker itself only needs the dead letter.
  if (typeof nodeId === "string" && event.type !== kafkaTopics.workflowStepFailed) {
    events.push(
      createEvent({
        ...base,
        type: kafkaTopics.workflowStepFailed,
        payload: { nodeId, message: errorMessage(error), attempts }
      })
    );
  }

  return events;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "unknown error");
}

/** In-memory store for unit tests and local experiments. */
export class InMemoryProcessedMessageStore implements ProcessedMessageStore {
  readonly entries = new Map<string, string>();

  async isProcessed(consumerGroup: string, idempotencyKey: string) {
    return this.entries.has(`${consumerGroup}|${idempotencyKey}`);
  }

  async markProcessed(consumerGroup: string, idempotencyKey: string, _eventId: string, outcome: string) {
    this.entries.set(`${consumerGroup}|${idempotencyKey}`, outcome);
  }
}
