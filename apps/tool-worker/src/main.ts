import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, eventEnvelopeSchema, kafkaTopics } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { handleToolCallRequested } from "./tool-call.handler";

const logger = pino({ name: "tool-worker" });

async function main() {
  const kafka = new Kafka({
    clientId: "agentops-tool-worker",
    brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094")
  });
  const consumer = kafka.consumer({ groupId: consumerGroups.toolWorker });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopics.toolCallRequested, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
      const completed = handleToolCallRequested(event);
      logger.info({ workflowRunId: completed.workflowRunId, eventId: completed.eventId }, "tool call processed");
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "tool worker failed");
    process.exit(1);
  });
}

