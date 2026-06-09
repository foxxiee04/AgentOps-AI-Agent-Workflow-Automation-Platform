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
import { handleToolCallRequested } from "./tool-call.handler";

const logger = pino({ name: "tool-worker" });
const metrics = new WorkerMetrics("tool-worker");

async function main() {
  startOpenTelemetry({ serviceName: "agentops-tool-worker", serviceVersion: "0.1.0" });
  metrics.startServer(resolveMetricsPort("TOOL_WORKER_METRICS_PORT", 4103), (message) => logger.info(message));
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

      const startedAt = Date.now();
      try {
        const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
        const completed = await withOtelSpan(
          `kafka consume ${kafkaTopics.toolCallRequested}`,
          {
            kind: SpanKind.CONSUMER,
            traceparent: traceparentFromTraceCarrier(event),
            attributes: {
              "messaging.system": "kafka",
              "messaging.destination.name": kafkaTopics.toolCallRequested,
              "messaging.kafka.consumer.group": consumerGroups.toolWorker,
              "agentops.event_id": event.eventId,
              "agentops.workflow_run_id": event.workflowRunId,
              "agentops.request_id": event.requestId
            }
          },
          (span) =>
            handleToolCallRequested({
              ...event,
              traceId: span.spanContext().traceId,
              traceparent: traceparentFromSpan(span) ?? event.traceparent
            })
        );
        metrics.recordMessage({
          topic: kafkaTopics.toolCallRequested,
          groupId: consumerGroups.toolWorker,
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
          "tool call processed"
        );
      } catch (error) {
        metrics.recordMessage({
          topic: kafkaTopics.toolCallRequested,
          groupId: consumerGroups.toolWorker,
          status: "error",
          durationMs: Date.now() - startedAt
        });
        metrics.recordError({
          topic: kafkaTopics.toolCallRequested,
          groupId: consumerGroups.toolWorker,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        throw error;
      }
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "tool worker failed");
    process.exit(1);
  });
}
