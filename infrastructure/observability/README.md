# Observability

Observability should make workflow execution debuggable.

## MVP Signals

- Structured API logs.
- Worker logs with `eventId` and `workflowRunId`.
- Request IDs and correlation IDs.
- Workflow run logs and step logs in the dashboard.
- Health check endpoints.

## Advanced Signals

- Prometheus metrics.
- Grafana dashboard.
- Kafka consumer lag monitoring.
- OpenTelemetry tracing.

Suggested metrics:

```txt
workflow_runs_total
workflow_runs_failed_total
workflow_step_duration_seconds
ai_tokens_used_total
kafka_messages_consumed_total
worker_errors_total
```

