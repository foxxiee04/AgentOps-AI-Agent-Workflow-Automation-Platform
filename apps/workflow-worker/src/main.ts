import { Kafka } from "kafkajs";
import pino from "pino";
import { eventEnvelopeSchema, kafkaTopics, consumerGroups } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { handleWorkflowTriggered } from "./executor";

const logger = pino({ name: "workflow-worker" });

async function main() {
  const kafka = new Kafka({
    clientId: "agentops-workflow-worker",
    brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094")
  });
  const consumer = kafka.consumer({ groupId: consumerGroups.workflowWorker });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopics.workflowTriggered, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
      const plan = handleWorkflowTriggered(event);
      logger.info(
        {
          workflowRunId: plan.workflowRunId,
          taskRequests: plan.taskRequests.length,
          terminalEvents: plan.terminalEvents.length,
          issues: plan.issues
        },
        "workflow event processed"
      );
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "workflow worker failed");
    process.exit(1);
  });
}

