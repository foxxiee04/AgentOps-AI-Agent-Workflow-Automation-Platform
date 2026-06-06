import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, eventEnvelopeSchema, kafkaTopics } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { handleAgentTaskRequested } from "./agent-task.handler";

const logger = pino({ name: "ai-worker" });

async function main() {
  const kafka = new Kafka({
    clientId: "agentops-ai-worker",
    brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094")
  });
  const consumer = kafka.consumer({ groupId: consumerGroups.aiWorker });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopics.agentTaskRequested, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
      const completed = handleAgentTaskRequested(event);
      logger.info({ workflowRunId: completed.workflowRunId, eventId: completed.eventId }, "AI task completed");
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "AI worker failed");
    process.exit(1);
  });
}

