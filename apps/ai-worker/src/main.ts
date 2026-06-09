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
import { handleAgentTaskRequested } from "./agent-task.handler";

const logger = pino({ name: "ai-worker" });
const metrics = new WorkerMetrics("ai-worker");

async function main() {
  startOpenTelemetry({ serviceName: "agentops-ai-worker", serviceVersion: "0.1.0" });
  metrics.startServer(resolveMetricsPort("AI_WORKER_METRICS_PORT", 4102), (message) => logger.info(message));
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

      const startedAt = Date.now();
      try {
        const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
        const completed = await withOtelSpan(
          `kafka consume ${kafkaTopics.agentTaskRequested}`,
          {
            kind: SpanKind.CONSUMER,
            traceparent: traceparentFromTraceCarrier(event),
            attributes: {
              "messaging.system": "kafka",
              "messaging.destination.name": kafkaTopics.agentTaskRequested,
              "messaging.kafka.consumer.group": consumerGroups.aiWorker,
              "agentops.event_id": event.eventId,
              "agentops.workflow_run_id": event.workflowRunId,
              "agentops.request_id": event.requestId
            }
          },
          (span) =>
            handleAgentTaskRequested({
              ...event,
              traceId: span.spanContext().traceId,
              traceparent: traceparentFromSpan(span) ?? event.traceparent
            })
        );
        metrics.recordMessage({
          topic: kafkaTopics.agentTaskRequested,
          groupId: consumerGroups.aiWorker,
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
          "AI task completed"
        );
      } catch (error) {
        metrics.recordMessage({
          topic: kafkaTopics.agentTaskRequested,
          groupId: consumerGroups.aiWorker,
          status: "error",
          durationMs: Date.now() - startedAt
        });
        metrics.recordError({
          topic: kafkaTopics.agentTaskRequested,
          groupId: consumerGroups.aiWorker,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        throw error;
      }
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "AI worker failed");
    process.exit(1);
  });
}
