import {
  context,
  isSpanContextValid,
  ROOT_CONTEXT,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Span
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION
} from "@opentelemetry/semantic-conventions";
import { createTraceId, createTraceparent, parseTraceparent } from "./trace";

export { SpanKind, SpanStatusCode } from "@opentelemetry/api";

export type StartOpenTelemetryOptions = {
  serviceName: string;
  serviceVersion?: string;
  deploymentEnvironment?: string;
};

export type StartOtelSpanOptions = {
  tracerName?: string;
  kind?: SpanKind;
  traceparent?: string;
  attributes?: Attributes;
  /**
   * Start a new trace when `traceparent` is absent instead of nesting under whatever span is active. Inbound
   * request spans need this: async context can leak across keep-alive requests on the same socket, which made a
   * request span a child of an unrelated (and already finished) span.
   */
  root?: boolean;
};

let sdk: NodeSDK | undefined;

export function startOpenTelemetry(options: StartOpenTelemetryOptions) {
  if (sdk || !isOpenTelemetryEnabled()) {
    return sdk;
  }

  const traceExporter = new OTLPTraceExporter(
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ? { url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT }
      : undefined
  );

  sdk = new NodeSDK({
    resource: resourceFromAttributes(cleanAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? options.deploymentEnvironment ?? process.env.NODE_ENV
    })),
    traceExporter
  });

  sdk.start();
  return sdk;
}

export async function shutdownOpenTelemetry() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = undefined;
}

export function extractOtelContext(traceparent: string | undefined): Context {
  const parsed = parseTraceparent(traceparent);

  if (!parsed) {
    return context.active();
  }

  return propagation.extract(context.active(), { traceparent: parsed.traceparent });
}

export function startOtelSpan(name: string, options: StartOtelSpanOptions = {}) {
  const parentContext =
    options.root && !parseTraceparent(options.traceparent) ? ROOT_CONTEXT : extractOtelContext(options.traceparent);
  const span = trace.getTracer(options.tracerName ?? "agentops").startSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: cleanAttributes(options.attributes ?? {})
    },
    parentContext
  );
  const spanContext = trace.setSpan(parentContext, span);

  if (!isSpanContextValid(span.spanContext())) {
    // OTel disabled: keep correlating logs/events with the caller's trace id (or a fresh one).
    const traceId = parseTraceparent(options.traceparent)?.traceId ?? createTraceId();
    return { span, context: spanContext, traceId, traceparent: createTraceparent(traceId) };
  }

  return {
    span,
    context: spanContext,
    traceId: span.spanContext().traceId,
    traceparent: traceparentFromSpan(span)
  };
}

export async function withOtelSpan<T>(
  name: string,
  options: StartOtelSpanOptions,
  callback: (span: Span) => Promise<T> | T
): Promise<T> {
  const activeSpan = startOtelSpan(name, options);

  return context.with(activeSpan.context, async () => {
    try {
      return await callback(activeSpan.span);
    } catch (error) {
      recordSpanException(activeSpan.span, error);
      throw error;
    } finally {
      activeSpan.span.end();
    }
  });
}

export function runWithOtelContext<T>(otelContext: Context, callback: () => T): T {
  return context.with(otelContext, callback);
}

export function traceparentFromSpan(span: Pick<Span, "spanContext">) {
  const spanContext = span.spanContext();

  if (!spanContext.traceId || !spanContext.spanId || !isSpanContextValid(spanContext)) {
    return undefined;
  }

  return createTraceparent(spanContext.traceId, spanContext.spanId, spanContext.traceFlags & 1 ? "01" : "00");
}

export function recordSpanException(span: Span, error: unknown) {
  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    return;
  }

  span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
}

function isOpenTelemetryEnabled() {
  if (process.env.OTEL_ENABLED === "false") {
    return false;
  }

  return (
    process.env.OTEL_ENABLED === "true" ||
    Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) ||
    Boolean(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
  );
}

function cleanAttributes(attributes: Attributes): Attributes {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined)) as Attributes;
}
