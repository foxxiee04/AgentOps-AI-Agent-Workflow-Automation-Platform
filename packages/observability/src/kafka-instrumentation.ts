import { SpanKind } from "@opentelemetry/api";
import { traceparentFromSpan, withOtelSpan } from "./opentelemetry";
import { traceparentFromTraceCarrier } from "./trace";

type Outcome = { status: string; error?: string };

const invalidTraceId = /^0+$/;

/**
 * Wraps one Kafka message in a CONSUMER span and rewrites the envelope's `traceId`/`traceparent`
 * to that span, so events published by the handler become its children in Tempo.
 */
export function createKafkaInstrumentation(groupId: string) {
  return async <T extends Outcome>(topic: string, value: string, run: (value: string) => Promise<T>): Promise<T> => {
    let envelope: Record<string, unknown> | undefined;
    try {
      envelope = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return run(value);
    }

    const carrier = {
      traceId: typeof envelope["traceId"] === "string" ? envelope["traceId"] : undefined,
      traceparent: typeof envelope["traceparent"] === "string" ? envelope["traceparent"] : undefined
    };

    return withOtelSpan(
      `kafka consume ${topic}`,
      {
        kind: SpanKind.CONSUMER,
        traceparent: traceparentFromTraceCarrier(carrier),
        attributes: {
          "messaging.system": "kafka",
          "messaging.destination.name": topic,
          "messaging.kafka.consumer.group": groupId,
          "agentops.event_id": String(envelope["eventId"] ?? ""),
          "agentops.workflow_run_id": String(envelope["workflowRunId"] ?? ""),
          "agentops.request_id": String(envelope["requestId"] ?? ""),
          "agentops.node_id": String((envelope["payload"] as Record<string, unknown> | undefined)?.["nodeId"] ?? "")
        }
      },
      async (span) => {
        const traceId = span.spanContext().traceId;
        const traced =
          traceId && !invalidTraceId.test(traceId)
            ? JSON.stringify({ ...envelope, traceId, traceparent: traceparentFromSpan(span) ?? envelope?.["traceparent"] })
            : value;
        const outcome = await run(traced);
        span.setAttribute("agentops.outcome", outcome.status);
        if (outcome.error) {
          span.setAttribute("agentops.error", outcome.error);
        }
        return outcome;
      }
    );
  };
}
