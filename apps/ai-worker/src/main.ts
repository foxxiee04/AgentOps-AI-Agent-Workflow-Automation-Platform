import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, kafkaTopics, registerGracefulShutdown, startKafkaWorker, type ProcessedMessageStore } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { createPrismaClient, PrismaProcessedMessageStore } from "@agentops/database";
import {
  AiMetrics,
  createKafkaInstrumentation,
  logRedactPaths,
  resolveMetricsPort,
  startOpenTelemetry,
  WorkerMetrics
} from "@agentops/observability";
import { handleAgentTaskRequested, type AgentTaskDeps } from "./agent-task.handler";
import { PrismaAiUsageGuard } from "./usage-guard";

const logger = pino({ name: "ai-worker", redact: { paths: logRedactPaths, censor: "[REDACTED]" } });

export type StartAiWorkerOptions = {
  kafka?: Kafka;
  groupId?: string;
  databaseUrl?: string;
  store?: ProcessedMessageStore;
  metrics?: WorkerMetrics;
  providerFactory?: AgentTaskDeps["providerFactory"];
};

export async function startAiWorker(options: StartAiWorkerOptions = {}) {
  const prisma = createPrismaClient(options.databaseUrl);
  const kafka =
    options.kafka ?? new Kafka({ clientId: "agentops-ai-worker", brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094") });
  const groupId = options.groupId ?? consumerGroups.aiWorker;
  const aiMetrics = options.metrics?.register(new AiMetrics().prime("mock", "gpt-4o-mini").prime("openai", "gpt-4o-mini"));
  const deps: AgentTaskDeps = { usage: new PrismaAiUsageGuard(prisma), providerFactory: options.providerFactory, metrics: aiMetrics };

  const handle = await startKafkaWorker({
    kafka,
    groupId,
    topics: [kafkaTopics.agentTaskRequested],
    store: options.store ?? new PrismaProcessedMessageStore(prisma),
    handler: async (event) => {
      const completed = await handleAgentTaskRequested(event, deps);
      logger.info(
        {
          workflowRunId: completed.workflowRunId,
          nodeId: completed.payload["nodeId"],
          eventId: completed.eventId,
          parentEventId: completed.parentEventId,
          traceId: completed.traceId,
          requestId: completed.requestId,
          provider: completed.payload["provider"],
          modelName: completed.payload["modelName"],
          tokenUsage: completed.payload["tokenUsage"],
          attempts: completed.payload["attempts"]
        },
        "AI task completed"
      );
      return [completed];
    },
    instrument: createKafkaInstrumentation(groupId),
    onOutcome: (topic, outcome, durationMs) => {
      options.metrics?.recordOutcome(topic, groupId, outcome, durationMs);
      if (outcome.status === "dead_lettered") {
        logger.error({ topic, idempotencyKey: outcome.idempotencyKey, error: outcome.error }, "AI task dead-lettered");
      }
    }
  });
  logger.info({ groupId }, "AI worker started");

  return {
    ...handle,
    async stop() {
      await handle.stop();
      await prisma.$disconnect();
    }
  };
}

if (require.main === module) {
  startOpenTelemetry({ serviceName: "agentops-ai-worker", serviceVersion: "0.1.0" });
  const metrics = new WorkerMetrics("ai-worker");
  metrics.startServer(resolveMetricsPort("AI_WORKER_METRICS_PORT", 4102), (message) => logger.info(message));
  startAiWorker({ metrics })
    .then((handle) => registerGracefulShutdown(() => handle.stop(), (message) => logger.info(message)))
    .catch((error) => {
    logger.error(error, "AI worker failed");
    process.exit(1);
  });
}
