import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, kafkaTopics, registerGracefulShutdown, startKafkaWorker, type ProcessedMessageStore } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { createPrismaClient, PrismaProcessedMessageStore } from "@agentops/database";
import { BusinessMetrics, createKafkaInstrumentation, logRedactPaths, resolveMetricsPort, startOpenTelemetry, WorkerMetrics } from "@agentops/observability";
import { handleNotificationRequested, type NotificationSink } from "./notification.handler";

const logger = pino({ name: "notification-worker", redact: { paths: logRedactPaths, censor: "[REDACTED]" } });

export type StartNotificationWorkerOptions = {
  kafka?: Kafka;
  groupId?: string;
  databaseUrl?: string;
  store?: ProcessedMessageStore;
  metrics?: WorkerMetrics;
};

export async function startNotificationWorker(options: StartNotificationWorkerOptions = {}) {
  const prisma = createPrismaClient(options.databaseUrl);
  const kafka =
    options.kafka ??
    new Kafka({ clientId: "agentops-notification-worker", brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094") });
  const groupId = options.groupId ?? consumerGroups.notificationWorker;
  const business = options.metrics?.register(new BusinessMetrics());
  const sink: NotificationSink = {
    async create(notification) {
      await prisma.notification.create({
        data: {
          workspaceId: notification.workspaceId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          metadataJson: JSON.parse(JSON.stringify(notification.metadata)) as never
        }
      });
      if (notification.type === "SALES_TASK") {
        business?.salesTaskCreated(notification.type);
      }
    }
  };

  const handle = await startKafkaWorker({
    kafka,
    groupId,
    topics: [kafkaTopics.notificationRequested],
    store: options.store ?? new PrismaProcessedMessageStore(prisma),
    handler: async (event) => {
      const events = await handleNotificationRequested(event, sink);
      logger.info({ workflowRunId: event.workflowRunId, nodeId: event.payload["nodeId"], kind: event.payload["kind"] }, "notification created");
      return events;
    },
    instrument: createKafkaInstrumentation(groupId),
    onOutcome: (topic, outcome, durationMs) => options.metrics?.recordOutcome(topic, groupId, outcome, durationMs)
  });
  logger.info({ groupId }, "notification worker started");

  return {
    ...handle,
    async stop() {
      await handle.stop();
      await prisma.$disconnect();
    }
  };
}

if (require.main === module) {
  startOpenTelemetry({ serviceName: "agentops-notification-worker", serviceVersion: "0.1.0" });
  const metrics = new WorkerMetrics("notification-worker");
  metrics.startServer(resolveMetricsPort("NOTIFICATION_WORKER_METRICS_PORT", 4104), (message) => logger.info(message));
  startNotificationWorker({ metrics })
    .then((handle) => registerGracefulShutdown(() => handle.stop(), (message) => logger.info(message)))
    .catch((error) => {
    logger.error(error, "notification worker failed");
    process.exit(1);
  });
}
