import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, eventEnvelopeSchema, kafkaTopics } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import {
  resolveMetricsPort,
  SpanKind,
  startOpenTelemetry,
  traceparentFromSpan,
  traceparentFromTraceCarrier,
  withOtelSpan,
  WorkerMetrics
} from "@agentops/observability";
import { handleNotificationRequested } from "./notification.handler";

const logger = pino({ name: "notification-worker" });
const metrics = new WorkerMetrics("notification-worker");

async function main() {
  startOpenTelemetry({ serviceName: "agentops-notification-worker", serviceVersion: "0.1.0" });
  metrics.startServer(resolveMetricsPort("NOTIFICATION_WORKER_METRICS_PORT", 4104), (message) => logger.info(message));
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

      const startedAt = Date.now();
      try {
        const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
        const completed = await withOtelSpan(
          `kafka consume ${kafkaTopics.notificationRequested}`,
          {
            kind: SpanKind.CONSUMER,
            traceparent: traceparentFromTraceCarrier(event),
            attributes: {
              "messaging.system": "kafka",
              "messaging.destination.name": kafkaTopics.notificationRequested,
              "messaging.kafka.consumer.group": consumerGroups.notificationWorker,
              "agentops.event_id": event.eventId,
              "agentops.workflow_run_id": event.workflowRunId,
              "agentops.request_id": event.requestId
            }
          },
          (span) =>
            handleNotificationRequested({
              ...event,
              traceId: span.spanContext().traceId,
              traceparent: traceparentFromSpan(span) ?? event.traceparent
            })
        );
        metrics.recordMessage({
          topic: kafkaTopics.notificationRequested,
          groupId: consumerGroups.notificationWorker,
          status: "success",
          durationMs: Date.now() - startedAt
        });
        logger.info(
          {
            workflowRunId: completed.workflowRunId,
            eventId: completed.eventId,
            parentEventId: completed.parentEventId,
            traceId: completed.traceId,
            requestId: completed.requestId
          },
          "notification processed"
        );
      } catch (error) {
        metrics.recordMessage({
          topic: kafkaTopics.notificationRequested,
          groupId: consumerGroups.notificationWorker,
          status: "error",
          durationMs: Date.now() - startedAt
        });
        metrics.recordError({
          topic: kafkaTopics.notificationRequested,
          groupId: consumerGroups.notificationWorker,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        throw error;
      }
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "notification worker failed");
    process.exit(1);
  });
}
