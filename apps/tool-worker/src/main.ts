import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, kafkaTopics, registerGracefulShutdown, startKafkaWorker, type ProcessedMessageStore } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { createPrismaClient, PrismaProcessedMessageStore } from "@agentops/database";
import { createKafkaInstrumentation, logRedactPaths, resolveMetricsPort, startOpenTelemetry, WorkerMetrics } from "@agentops/observability";
import { handleToolCallRequested } from "./tool-call.handler";

const logger = pino({ name: "tool-worker", redact: { paths: logRedactPaths, censor: "[REDACTED]" } });

export type StartToolWorkerOptions = {
  kafka?: Kafka;
  groupId?: string;
  databaseUrl?: string;
  store?: ProcessedMessageStore;
  metrics?: WorkerMetrics;
};

export async function startToolWorker(options: StartToolWorkerOptions = {}) {
  const prisma = options.store ? undefined : createPrismaClient(options.databaseUrl);
  const kafka =
    options.kafka ?? new Kafka({ clientId: "agentops-tool-worker", brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094") });
  const groupId = options.groupId ?? consumerGroups.toolWorker;

  const handle = await startKafkaWorker({
    kafka,
    groupId,
    topics: [kafkaTopics.toolCallRequested],
    store: options.store ?? new PrismaProcessedMessageStore(prisma!),
    handler: (event) => {
      const result = handleToolCallRequested(event);
      logger.info(
        { workflowRunId: result.workflowRunId, nodeId: result.payload["nodeId"], type: result.type, toolType: event.payload["toolType"] },
        "tool call handled"
      );
      return [result];
    },
    instrument: createKafkaInstrumentation(groupId),
    onOutcome: (topic, outcome, durationMs) => options.metrics?.recordOutcome(topic, groupId, outcome, durationMs)
  });
  logger.info({ groupId }, "tool worker started");

  return {
    ...handle,
    async stop() {
      await handle.stop();
      await prisma?.$disconnect();
    }
  };
}

if (require.main === module) {
  startOpenTelemetry({ serviceName: "agentops-tool-worker", serviceVersion: "0.1.0" });
  const metrics = new WorkerMetrics("tool-worker");
  metrics.startServer(resolveMetricsPort("TOOL_WORKER_METRICS_PORT", 4103), (message) => logger.info(message));
  startToolWorker({ metrics })
    .then((handle) => registerGracefulShutdown(() => handle.stop(), (message) => logger.info(message)))
    .catch((error) => {
    logger.error(error, "tool worker failed");
    process.exit(1);
  });
}
