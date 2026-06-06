import { Injectable, Logger } from "@nestjs/common";
import { createEvent, type CreateEventInput, type EventEnvelope } from "@agentops/events";

@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);
  private readonly events: EventEnvelope[] = [];

  publish<TPayload extends Record<string, unknown>>(input: CreateEventInput<TPayload>): EventEnvelope<TPayload> {
    const event = createEvent(input);
    this.events.push(event);
    this.logger.log(`Published ${event.type} for run ${event.workflowRunId}`);
    return event;
  }

  listRecent(): EventEnvelope[] {
    return [...this.events].slice(-20).reverse();
  }
}

