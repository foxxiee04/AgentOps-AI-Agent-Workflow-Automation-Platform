import { Injectable, Logger } from "@nestjs/common";
import { createEvent, type CreateEventInput, type EventEnvelope } from "@agentops/events";
import { getRequestContext } from "../http/request-context";

@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);
  private readonly events: EventEnvelope[] = [];

  publish<TPayload extends Record<string, unknown>>(input: CreateEventInput<TPayload>): EventEnvelope<TPayload> {
    const context = getRequestContext();
    const event = createEvent({
      ...input,
      requestId: input.requestId ?? context?.requestId,
      traceId: input.traceId ?? context?.traceId,
      traceparent: input.traceparent ?? context?.traceparent
    });
    this.events.push(event);
    this.logger.log(
      JSON.stringify({
        message: "domain event published",
        type: event.type,
        eventId: event.eventId,
        workflowRunId: event.workflowRunId,
        requestId: event.requestId,
        traceId: event.traceId,
        traceparent: event.traceparent
      })
    );
    return event;
  }

  listRecent(): EventEnvelope[] {
    return [...this.events].slice(-20).reverse();
  }
}
