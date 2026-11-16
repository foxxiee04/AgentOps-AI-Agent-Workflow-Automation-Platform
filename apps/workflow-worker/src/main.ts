import { Kafka } from "kafkajs";
import pino from "pino";
import { consumerGroups, kafkaTopics, registerGracefulShutdown, startKafkaWorker, type EventEnvelope, type ProcessedMessageStore } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { createPrismaClient, PrismaProcessedMessageStore } from "@agentops/database";
import {
  BusinessMetrics,
  createKafkaInstrumentation,
  logRedactPaths,
  resolveMetricsPort,
  startOpenTelemetry,
  startOtelSpan,
  WorkerMetrics
} from "@agentops/observability";
import { handleWorkflowEvent, resolveAutoApprove, type WorkflowExecutionPlan } from "./executor";
import { PrismaRunStateStore, type RunStateStore } from "./prisma-run-state-store";
import { projectRunState } from "./run-state";

const logger = pino({ name: "workflow-worker", redact: { paths: logRedactPaths, censor: "[REDACTED]" } });

export const workflowWorkerTopics = [
  kafkaTopics.workflowTriggered,
  kafkaTopics.agentTaskCompleted,
  kafkaTopics.toolCallCompleted,
  kafkaTopics.humanApprovalDecided,
  kafkaTopics.workflowStepFailed
];

export type WorkflowWorkerDeps = {
  runState: RunStateStore;
  autoApprove: boolean;
  metrics?: Pick<BusinessMetrics, "leadScored" | "branchTaken" | "approvalRequested">;
};

/** Business metrics derived from one processed event: lead categories, branch decisions, approvals. */
export function recordPlanMetrics(
  event: EventEnvelope,
  plan: WorkflowExecutionPlan,
  metrics: NonNullable<WorkflowWorkerDeps["metrics"]>
) {
  const output = event.payload["output"] as Record<string, unknown> | undefined;
  if (event.type === kafkaTopics.agentTaskCompleted && typeof output?.["leadScore"] === "number") {
    metrics.leadScored(String(output["category"] ?? "unknown"));
  }
  for (const step of plan.startedSteps) {
    const branch = (step.payload["output"] as { branch?: unknown } | undefined)?.branch;
    if (step.type === kafkaTopics.workflowStepCompleted && Array.isArray(branch)) {
      for (const target of branch) {
        metrics.branchTaken(String(step.payload["nodeId"]), String(target));
      }
    }
  }
  for (const request of plan.taskRequests) {
    if (request.type === kafkaTopics.humanApprovalRequested) {
      metrics.approvalRequested();
    }
  }
}

/** One span per node the step started, as children of the Kafka consumer span (visible in Tempo). */
function traceNodes(plan: WorkflowExecutionPlan) {
  for (const step of plan.startedSteps) {
    if (step.type !== kafkaTopics.workflowStepStarted) {
      continue;
    }
    const span = startOtelSpan(`workflow.node ${String(step.payload["nodeType"])}`, {
      attributes: {
        "agentops.node_id": String(step.payload["nodeId"]),
        "agentops.node_type": String(step.payload["nodeType"]),
        "agentops.workflow_run_id": step.workflowRunId,
        "agentops.step_status": String(step.payload["status"] ?? "RUNNING")
      }
    });
    span.span.end();
  }
}

/** Executes the graph step and persists run state before the resulting events are published. */
export function createWorkflowHandler(deps: WorkflowWorkerDeps) {
  return async (event: EventEnvelope): Promise<EventEnvelope[]> => {
    const plan = handleWorkflowEvent(event, { autoApprove: deps.autoApprove });
    await deps.runState.apply(projectRunState(event, plan));
    traceNodes(plan);
    if (deps.metrics) {
      recordPlanMetrics(event, plan, deps.metrics);
    }
    logger.info(
      {
        type: event.type,
        eventId: event.eventId,
        workflowRunId: event.workflowRunId,
        nodeId: event.payload["nodeId"],
        requestId: event.requestId,
        traceId: event.traceId,
        taskRequests: plan.taskRequests.length,
        terminal: plan.terminalEvents.map((terminal) => terminal.type),
        issues: plan.issues
      },
      "workflow event processed"
    );
    return [...plan.startedSteps, ...plan.taskRequests, ...plan.terminalEvents];
  };
}

export type StartWorkflowWorkerOptions = {
  kafka?: Kafka;
  groupId?: string;
  databaseUrl?: string;
  autoApprove?: boolean;
  store?: ProcessedMessageStore;
  metrics?: WorkerMetrics;
};

export async function startWorkflowWorker(options: StartWorkflowWorkerOptions = {}) {
  const prisma = createPrismaClient(options.databaseUrl);
  const kafka =
    options.kafka ??
    new Kafka({ clientId: "agentops-workflow-worker", brokers: parseKafkaBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094") });
  const groupId = options.groupId ?? consumerGroups.workflowWorker;
  const autoApprove = options.autoApprove ?? resolveAutoApprove();

  const handle = await startKafkaWorker({
    kafka,
    groupId,
    topics: workflowWorkerTopics,
    store: options.store ?? new PrismaProcessedMessageStore(prisma),
    handler: createWorkflowHandler({
      runState: new PrismaRunStateStore(prisma),
      autoApprove,
      metrics: options.metrics?.register(new BusinessMetrics())
    }),
    instrument: createKafkaInstrumentation(groupId),
    onOutcome: (topic, outcome, durationMs) => {
      options.metrics?.recordOutcome(topic, groupId, outcome, durationMs);
      if (outcome.status === "dead_lettered") {
        logger.error({ topic, idempotencyKey: outcome.idempotencyKey, error: outcome.error }, "message dead-lettered");
      }
    }
  });
  logger.info({ groupId, autoApprove }, "workflow worker started");

  return {
    ...handle,
    async stop() {
      await handle.stop();
      await prisma.$disconnect();
    }
  };
}

if (require.main === module) {
  startOpenTelemetry({ serviceName: "agentops-workflow-worker", serviceVersion: "0.1.0" });
  const metrics = new WorkerMetrics("workflow-worker");
  metrics.startServer(resolveMetricsPort("WORKFLOW_WORKER_METRICS_PORT", 4101), (message) => logger.info(message));
  startWorkflowWorker({ metrics })
    .then((handle) => registerGracefulShutdown(() => handle.stop(), (message) => logger.info(message)))
    .catch((error) => {
    logger.error(error, "workflow worker failed");
    process.exit(1);
  });
}
