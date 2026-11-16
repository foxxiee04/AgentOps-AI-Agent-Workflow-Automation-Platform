import type { Consumer, Kafka } from "kafkajs";
import { processMessage, type MessageOutcome, type ProcessMessageOptions, type ProcessedMessageStore } from "./consumer";
import { createEventPublisher, type EventPublisher } from "./publisher";

export type KafkaWorkerOptions = {
  kafka: Kafka;
  groupId: string;
  topics: string[];
  handler: ProcessMessageOptions["handler"];
  store: ProcessedMessageStore;
  maxAttempts?: number;
  /** Lets the worker wrap each message with tracing/metrics; must call `run`. */
  instrument?: (topic: string, value: string, run: (value: string) => Promise<MessageOutcome>) => Promise<MessageOutcome>;
  onOutcome?: (topic: string, outcome: MessageOutcome, durationMs: number) => void;
  fromBeginning?: boolean;
  /** Partitions handled in parallel (topics have 3); ordering per partition, i.e. per run, is kept. */
  partitionsConsumedConcurrently?: number;
};

export type KafkaWorkerHandle = {
  consumer: Consumer;
  publisher: EventPublisher;
  stop(): Promise<void>;
};

/**
 * Starts a consumer group whose offsets are committed only after `processMessage` finished
 * (handled, skipped as duplicate, or dead-lettered), so durable state is written first.
 */
export async function startKafkaWorker(options: KafkaWorkerOptions): Promise<KafkaWorkerHandle> {
  const publisher = await createEventPublisher(options.kafka);
  const consumer = options.kafka.consumer({ groupId: options.groupId });
  await consumer.connect();
  for (const topic of options.topics) {
    await consumer.subscribe({ topic, fromBeginning: options.fromBeginning ?? false });
  }

  await consumer.run({
    partitionsConsumedConcurrently: options.partitionsConsumedConcurrently ?? 3,
    eachMessage: async ({ topic, message }) => {
      if (!message.value) {
        return;
      }
      const value = message.value.toString();
      const startedAt = Date.now();
      const run = (tracedValue: string) =>
        processMessage({
          topic,
          consumerGroup: options.groupId,
          value: tracedValue,
          handler: options.handler,
          publish: (events) => publisher.publish(events),
          store: options.store,
          maxAttempts: options.maxAttempts
        });
      const outcome = options.instrument ? await options.instrument(topic, value, run) : await run(value);
      options.onOutcome?.(topic, outcome, Date.now() - startedAt);
    }
  });

  return {
    consumer,
    publisher,
    async stop() {
      await consumer.disconnect();
      await publisher.disconnect();
    }
  };
}

/**
 * Stops the worker on SIGTERM/SIGINT (Kubernetes pod shutdown) so the consumer leaves its group
 * and partitions are reassigned immediately instead of after the session timeout.
 */
export function registerGracefulShutdown(
  stop: () => Promise<void>,
  log: (message: string) => void = () => undefined,
  exit: (code: number) => void = (code) => process.exit(code)
) {
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`received ${signal}, stopping worker`);
    stop()
      .then(() => exit(0))
      .catch(() => exit(1));
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return shutdown;
}
