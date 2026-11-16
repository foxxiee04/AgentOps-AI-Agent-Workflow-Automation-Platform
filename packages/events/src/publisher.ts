import type { Kafka, Producer } from "kafkajs";
import type { EventEnvelope } from "./envelope";

export type EventPublisher = {
  publish(events: EventEnvelope[]): Promise<void>;
  disconnect(): Promise<void>;
};

/** Publishes event envelopes to the Kafka topic named by their `type`, keyed by workflow run for ordering. */
export async function createEventPublisher(kafka: Kafka): Promise<EventPublisher> {
  const producer: Producer = kafka.producer();
  await producer.connect();

  return {
    // One round trip per handled message: all events go out in a single batch, grouped by topic.
    // Order within a topic (and so within a run, which is the message key) is preserved.
    async publish(events) {
      if (events.length === 0) {
        return;
      }
      const byTopic = new Map<string, Array<{ key: string; value: string }>>();
      for (const event of events) {
        const messages = byTopic.get(event.type) ?? [];
        messages.push({ key: event.workflowRunId, value: JSON.stringify(event) });
        byTopic.set(event.type, messages);
      }
      await producer.sendBatch({ topicMessages: [...byTopic].map(([topic, messages]) => ({ topic, messages })) });
    },
    disconnect: () => producer.disconnect()
  };
}
