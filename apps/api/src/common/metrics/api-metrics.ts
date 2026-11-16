type LabelValue = string | number | boolean | undefined;
type Labels = Record<string, LabelValue>;

const contentType = "text/plain; version=0.0.4; charset=utf-8";

class CounterMetric {
  private readonly samples = new Map<string, { labels: Labels; value: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[]
  ) {}

  inc(labels: Labels = {}, amount = 1) {
    const normalizedLabels = this.normalizeLabels(labels);
    const key = labelKey(normalizedLabels);
    const sample = this.samples.get(key) ?? { labels: normalizedLabels, value: 0 };
    sample.value += amount;
    this.samples.set(key, sample);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const sample of this.samples.values()) {
      lines.push(`${this.name}${formatLabels(sample.labels)} ${sample.value}`);
    }
    return lines.join("\n");
  }

  private normalizeLabels(labels: Labels) {
    return Object.fromEntries(this.labelNames.map((name) => [name, labels[name] ?? "unknown"]));
  }
}

class GaugeMetric {
  private readonly samples = new Map<string, { labels: Labels; value: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[]
  ) {}

  set(labels: Labels = {}, value: number) {
    const normalizedLabels = this.normalizeLabels(labels);
    this.samples.set(labelKey(normalizedLabels), { labels: normalizedLabels, value });
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const sample of this.samples.values()) {
      lines.push(`${this.name}${formatLabels(sample.labels)} ${sample.value}`);
    }
    return lines.join("\n");
  }

  private normalizeLabels(labels: Labels) {
    return Object.fromEntries(this.labelNames.map((name) => [name, labels[name] ?? "unknown"]));
  }
}

class HistogramMetric {
  private readonly samples = new Map<string, { labels: Labels; buckets: number[]; sum: number; count: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[],
    private readonly bucketBounds: number[]
  ) {}

  observe(labels: Labels, value: number) {
    const normalizedLabels = this.normalizeLabels(labels);
    const key = labelKey(normalizedLabels);
    const sample =
      this.samples.get(key) ?? {
        labels: normalizedLabels,
        buckets: this.bucketBounds.map(() => 0),
        sum: 0,
        count: 0
      };

    sample.sum += value;
    sample.count += 1;
    this.bucketBounds.forEach((bound, index) => {
      if (value <= bound) {
        sample.buckets[index] += 1;
      }
    });
    this.samples.set(key, sample);
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const sample of this.samples.values()) {
      this.bucketBounds.forEach((bound, index) => {
        lines.push(`${this.name}_bucket${formatLabels({ ...sample.labels, le: bound })} ${sample.buckets[index]}`);
      });
      lines.push(`${this.name}_bucket${formatLabels({ ...sample.labels, le: "+Inf" })} ${sample.count}`);
      lines.push(`${this.name}_sum${formatLabels(sample.labels)} ${sample.sum}`);
      lines.push(`${this.name}_count${formatLabels(sample.labels)} ${sample.count}`);
    }
    return lines.join("\n");
  }

  private normalizeLabels(labels: Labels) {
    return Object.fromEntries(this.labelNames.map((name) => [name, labels[name] ?? "unknown"]));
  }
}

export const metricsRegistry = {
  contentType,
  metrics: async () => renderMetrics()
};

export const httpRequestsTotal = new CounterMetric("agentops_http_requests_total", "Total API HTTP requests.", [
  "method",
  "route",
  "status_code"
]);

export const httpRequestDurationSeconds = new HistogramMetric(
  "agentops_http_request_duration_seconds",
  "API HTTP request duration in seconds.",
  ["method", "route", "status_code"],
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
);

export const alertNotificationsTotal = new CounterMetric(
  "agentops_alertmanager_notifications_total",
  "Total Alertmanager webhook notifications received by the AgentOps alert bot endpoint.",
  ["status", "severity"]
);

export const workflowRunsTotal = new CounterMetric("agentops_workflow_runs_total", "Total workflow runs created through the API.", [
  "workspace_id",
  "workflow_id",
  "trigger_type"
]);

export const kafkaConsumerLag = new GaugeMetric(
  "agentops_kafka_consumer_lag",
  "Kafka consumer lag by consumer group, topic, and partition.",
  ["group_id", "topic", "partition"]
);

export const kafkaTopicMessages = new GaugeMetric(
  "agentops_kafka_topic_messages",
  "Messages currently retained in a Kafka topic (dead-letter-events = dead letters).",
  ["topic"]
);

export const approvalsPending = new GaugeMetric("agentops_approvals_pending", "Emails waiting for a reviewer decision.", ["workspace_id"]);

export const approvalDecisionsTotal = new CounterMetric("agentops_approval_decisions_total", "Reviewer decisions on drafted emails.", [
  "decision"
]);

export const domainEventsUnpublished = new GaugeMetric(
  "agentops_domain_events_unpublished",
  "Domain events stored in PostgreSQL but not yet published to Kafka (outbox backlog).",
  []
);

export const authLoginsTotal = new CounterMetric("agentops_auth_logins_total", "Login attempts.", ["provider", "result"]);

export const authRegistrationsTotal = new CounterMetric("agentops_auth_registrations_total", "User registrations.", ["provider"]);

export const usersTotal = new GaugeMetric("agentops_users_total", "Total registered users.", []);

export const activeUsers = new GaugeMetric(
  "agentops_active_users",
  "Distinct users who obtained a session (login, refresh or OAuth) in the window.",
  ["window"]
);

// Known label sets start at 0 so increase()/rate() also count the first login after an API restart.
for (const provider of ["password", "google"]) {
  authRegistrationsTotal.inc({ provider }, 0);
  for (const result of ["success", "failure"]) {
    authLoginsTotal.inc({ provider, result }, 0);
  }
}

export function recordLogin(provider: "password" | "google", result: "success" | "failure") {
  authLoginsTotal.inc({ provider, result });
}

export function recordRegistration(provider: "password" | "google") {
  authRegistrationsTotal.inc({ provider });
}

export function recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number) {
  const labels = {
    method,
    route: normalizeRoute(route),
    status_code: String(statusCode)
  };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, durationMs / 1000);
}

function renderMetrics() {
  return [
    "# HELP agentops_api_process_uptime_seconds API process uptime in seconds.",
    "# TYPE agentops_api_process_uptime_seconds gauge",
    `agentops_api_process_uptime_seconds ${process.uptime()}`,
    "# HELP agentops_api_process_resident_memory_bytes API resident memory size in bytes.",
    "# TYPE agentops_api_process_resident_memory_bytes gauge",
    `agentops_api_process_resident_memory_bytes ${process.memoryUsage().rss}`,
    httpRequestsTotal.render(),
    httpRequestDurationSeconds.render(),
    workflowRunsTotal.render(),
    kafkaConsumerLag.render(),
    kafkaTopicMessages.render(),
    approvalsPending.render(),
    approvalDecisionsTotal.render(),
    domainEventsUnpublished.render(),
    authLoginsTotal.render(),
    authRegistrationsTotal.render(),
    usersTotal.render(),
    activeUsers.render(),
    alertNotificationsTotal.render()
  ]
    .filter(Boolean)
    .join("\n\n")
    .concat("\n");
}

export function recordKafkaConsumerLag(samples: Array<{ groupId: string; topic: string; partition: number; lag: number }>) {
  for (const sample of samples) {
    kafkaConsumerLag.set(
      {
        group_id: sample.groupId,
        topic: sample.topic,
        partition: sample.partition
      },
      sample.lag
    );
  }
}

function normalizeRoute(route: string) {
  const [path = "/"] = route.split("?");
  return path
    .replace(/\/run_[^/]+/g, "/:runId")
    .replace(/\/wf_[^/]+/g, "/:workflowId")
    .replace(/\/wfv_[^/]+/g, "/:workflowVersionId")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":uuid");
}

function labelKey(labels: Labels) {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
}

function formatLabels(labels: Labels) {
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "";
  }

  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`).join(",")}}`;
}

function escapeLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
