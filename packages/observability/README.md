# Observability Package

Small helpers for AgentOps metrics and trace correlation.

Current exports:

- Prometheus text-format metric primitives.
- Worker metrics server for `/metrics` and `/health/live`.
- W3C-compatible trace ID and `traceparent` helpers.
- OpenTelemetry Node SDK bootstrap and manual span helpers for API/workers.

OpenTelemetry is opt-in. Set `OTEL_ENABLED=true` or configure `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to export spans.
