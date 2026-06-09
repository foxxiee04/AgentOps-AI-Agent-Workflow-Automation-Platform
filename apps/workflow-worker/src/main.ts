import { Kafka } from "kafkajs";
import pino from "pino";
import { eventEnvelopeSchema, kafkaTopics, consumerGroups } from "@agentops/events";
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
import { handleWorkflowTriggered } from "./executor";

const logger = pino({ name: "workflow-worker" });
const metrics = new WorkerMetrics("workflow-worker");

async function main() {
  startOpenTelemetry({ serviceName: "agentops-workflow-worker", serviceVersion: "0.1.0" });
  metrics.startServer(resolveMetricsPort("WORKFLOW_WORKER_METRICS_PORT", 4101), (message) => logger.info(message));
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

      const startedAt = Date.now();
      try {
        const event = eventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
        const plan = await withOtelSpan(
          `kafka consume ${kafkaTopics.workflowTriggered}`,
          {
            kind: SpanKind.CONSUMER,
            traceparent: traceparentFromTraceCarrier(event),
            attributes: {
              "messaging.system": "kafka",
              "messaging.destination.name": kafkaTopics.workflowTriggered,
              "messaging.kafka.consumer.group": consumerGroups.workflowWorker,
              "agentops.event_id": event.eventId,
              "agentops.workflow_run_id": event.workflowRunId,
              "agentops.request_id": event.requestId
            }
          },
          (span) =>
            handleWorkflowTriggered({
              ...event,
              traceId: span.spanContext().traceId,
              traceparent: traceparentFromSpan(span) ?? event.traceparent
            })
        );
        metrics.recordMessage({
          topic: kafkaTopics.workflowTriggered,
          groupId: consumerGroups.workflowWorker,
          status: "success",
          durationMs: Date.now() - startedAt
        });
        logger.info(
          {
            workflowRunId: plan.workflowRunId,
            eventId: event.eventId,
            traceId: event.traceId,
            requestId: event.requestId,
            taskRequests: plan.taskRequests.length,
            terminalEvents: plan.terminalEvents.length,
            issues: plan.issues
          },
          "workflow event processed"
        );
      } catch (error) {
        metrics.recordMessage({
          topic: kafkaTopics.workflowTriggered,
          groupId: consumerGroups.workflowWorker,
          status: "error",
          durationMs: Date.now() - startedAt
        });
        metrics.recordError({
          topic: kafkaTopics.workflowTriggered,
          groupId: consumerGroups.workflowWorker,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        throw error;
      }
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error, "workflow worker failed");
    process.exit(1);
  });
}
