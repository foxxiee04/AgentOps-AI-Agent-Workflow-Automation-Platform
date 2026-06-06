import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, eventEnvelopeSchema, kafkaTopics } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { handleNotificationRequested } from "./notification.handler";

const logger = pino({ name: "notification-worker" });

async function main() {
  const kafka = new Kafka({
    clientId: "agentops-notification-worker",
    brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094")
  });
  const consumer = kafka.consumer({ groupId: consumerGroups.notificationWorker });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopics.notificationRequested, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
      const completed = handleNotificationRequested(event);
      logger.info({ workflowRunId: completed.workflowRunId, eventId: completed.eventId }, "notification processed");
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "notification worker failed");
    process.exit(1);
  });
}

