import { randomBytes } from "node:crypto";

export type TraceContext = {
  traceId: string;
  traceparent: string;
};

export type TraceCarrier = {
  traceId?: string;
  traceparent?: string;
};

const traceparentPattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

export function createTraceId() {
  return randomBytes(16).toString("hex");
}

export function createSpanId() {
  return randomBytes(8).toString("hex");
}

export function createTraceparent(traceId = createTraceId(), spanId = createSpanId(), traceFlags = "01") {
  return `00-${traceId}-${spanId}-${traceFlags}`;
}

export function parseTraceparent(value: string | undefined): TraceContext | undefined {
  if (!value) {
    return undefined;
  }

  const match = traceparentPattern.exec(value.trim());
  if (!match?.[1]) {
    return undefined;
  }

  return {
    traceId: match[1].toLowerCase(),
    traceparent: value.trim().toLowerCase()
  };
}

export function traceparentFromTraceCarrier(carrier: TraceCarrier) {
  return carrier.traceparent ?? (carrier.traceId ? createTraceparent(carrier.traceId) : undefined);
}
