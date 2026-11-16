import { createServer, type Server } from "node:http";
import { CounterMetric, GaugeMetric, HistogramMetric, prometheusContentType } from "./metrics";

export type WorkerMetricEvent = {
  topic: string;
  groupId: string;
  status: "success" | "error";
  durationMs: number;
};

export type WorkerMetricError = {
  topic: string;
  groupId: string;
  errorType: string;
};

export class WorkerMetrics {
  private readonly messagesConsumedTotal = new CounterMetric(
    "agentops_worker_messages_consumed_total",
    "Total Kafka messages consumed by AgentOps workers.",
    ["worker", "topic", "group_id"]
  );
  private readonly messageDurationSeconds = new HistogramMetric(
    "agentops_worker_message_duration_seconds",
    "Kafka message processing duration in seconds.",
    ["worker", "topic", "group_id", "status"],
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]
  );
  private readonly errorsTotal = new CounterMetric("agentops_worker_errors_total", "Total AgentOps worker errors.", [
    "worker",
    "topic",
    "group_id",
    "error_type"
  ]);
  private readonly lastMessageTimestampSeconds = new GaugeMetric(
    "agentops_worker_last_message_timestamp_seconds",
    "Unix timestamp of the last Kafka message consumed by a worker.",
    ["worker", "topic", "group_id"]
  );

  private readonly outcomesTotal = new CounterMetric(
    "agentops_worker_message_outcomes_total",
    "Kafka messages by processing outcome (processed, duplicate, dead_lettered).",
    ["worker", "topic", "group_id", "outcome"]
  );
  private readonly deadLettersTotal = new CounterMetric(
    "agentops_worker_dead_letters_total",
    "Kafka messages sent to dead-letter-events after retries were exhausted.",
    ["worker", "topic", "group_id"]
  );

  private server: Server | undefined;
  private readonly extra: Array<{ render(): string }> = [];

  constructor(private readonly workerName: string) {}

  /** Adds domain metric families (AI, business) to this worker's /metrics output. */
  register<T extends { render(): string }>(renderable: T): T {
    this.extra.push(renderable);
    return renderable;
  }

  recordMessage(event: WorkerMetricEvent) {
    const labels = {
      worker: this.workerName,
      topic: event.topic,
      group_id: event.groupId
    };
    this.messagesConsumedTotal.inc(labels);
    this.messageDurationSeconds.observe({ ...labels, status: event.status }, event.durationMs / 1000);
    this.lastMessageTimestampSeconds.set(labels, Date.now() / 1000);
  }

  /** Records the result of `processMessage` (status = processed | duplicate | dead_lettered). */
  recordOutcome(topic: string, groupId: string, outcome: { status: string; error?: string }, durationMs: number) {
    const failed = outcome.status === "dead_lettered";
    this.recordMessage({ topic, groupId, status: failed ? "error" : "success", durationMs });
    this.outcomesTotal.inc({ worker: this.workerName, topic, group_id: groupId, outcome: outcome.status });
    if (failed) {
      this.deadLettersTotal.inc({ worker: this.workerName, topic, group_id: groupId });
      this.recordError({ topic, groupId, errorType: "DeadLettered" });
    }
  }

  recordError(error: WorkerMetricError) {
    this.errorsTotal.inc({
      worker: this.workerName,
      topic: error.topic,
      group_id: error.groupId,
      error_type: error.errorType
    });
  }

  startServer(port: number, log?: (message: string) => void) {
    if (this.server) {
      return this.server;
    }

    this.server = createServer((request, response) => {
      if (request.url === "/health/live") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "up", worker: this.workerName }));
        return;
      }

      if (request.url === "/metrics") {
        response.writeHead(200, { "Content-Type": prometheusContentType });
        response.end(this.render());
        return;
      }

      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("not found");
    });

    this.server.listen(port, () => log?.(`${this.workerName} metrics listening on :${port}`));
    return this.server;
  }

  render() {
    return [
      "# HELP agentops_worker_process_uptime_seconds Worker process uptime in seconds.",
      "# TYPE agentops_worker_process_uptime_seconds gauge",
      `agentops_worker_process_uptime_seconds{worker="${this.workerName}"} ${process.uptime()}`,
      "# HELP agentops_worker_process_resident_memory_bytes Worker resident memory size in bytes.",
      "# TYPE agentops_worker_process_resident_memory_bytes gauge",
      `agentops_worker_process_resident_memory_bytes{worker="${this.workerName}"} ${process.memoryUsage().rss}`,
      this.messagesConsumedTotal.render(),
      this.messageDurationSeconds.render(),
      this.errorsTotal.render(),
      this.lastMessageTimestampSeconds.render(),
      this.outcomesTotal.render(),
      this.deadLettersTotal.render(),
      ...this.extra.map((renderable) => renderable.render())
    ]
      .filter(Boolean)
      .join("\n\n")
      .concat("\n");
  }
}

export function resolveMetricsPort(envName: string, fallback: number) {
  const value = Number(process.env[envName] ?? process.env.WORKER_METRICS_PORT ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
