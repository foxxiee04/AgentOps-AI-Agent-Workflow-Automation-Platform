import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createEvent, type CreateEventInput, type EventEnvelope } from "@agentops/events";
import { parseKafkaBrokers } from "@agentops/config";
import { Prisma } from "@agentops/database";
import { Kafka, logLevel, type Producer } from "kafkajs";
import { PrismaService } from "../infrastructure/prisma.service";
import { getRequestContext } from "../http/request-context";

@Injectable()
export class DomainEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DomainEventsService.name);
  private readonly events: EventEnvelope[] = [];
  private producer: Producer | undefined;
  private producerConnected = false;
  private relayTimer: NodeJS.Timeout | undefined;

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService
  ) {}

  async publish<TPayload extends Record<string, unknown>>(input: CreateEventInput<TPayload>): Promise<EventEnvelope<TPayload>> {
    const context = getRequestContext();
    const event = createEvent({
      ...input,
      requestId: input.requestId ?? context?.requestId,
      traceId: input.traceId ?? context?.traceId,
      traceparent: input.traceparent ?? context?.traceparent
    });
    this.events.push(event);
    await this.persistEvent(event);

    try {
      await this.publishToKafka(event);
      await this.markPublished(event.eventId);
    } catch (error) {
      await this.markPublishFailed(event.eventId, error);
      throw error;
    }

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

  async listRecent(workspaceId?: string): Promise<EventEnvelope[]> {
    if (this.prisma) {
      const events = await this.prisma.client.domainEvent.findMany({
        where: workspaceId ? { workspaceId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 20
      });

      return events.map((event) => ({
        eventId: event.id,
        type: event.type as EventEnvelope["type"],
        workspaceId: event.workspaceId,
        workflowId: event.workflowId ?? undefined,
        workflowRunId: event.workflowRunId,
        requestId: event.requestId ?? undefined,
        traceId: event.traceId ?? undefined,
        traceparent: event.traceparent ?? undefined,
        parentEventId: event.parentEventId ?? undefined,
        timestamp: event.createdAt.toISOString(),
        payload: event.payloadJson as Record<string, unknown>
      }));
    }

    const recent = workspaceId ? this.events.filter((event) => event.workspaceId === workspaceId) : this.events;
    return [...recent].slice(-20).reverse();
  }

  /** Outbox relay: periodically re-sends events whose Kafka publish failed (kafkaPublishedAt IS NULL). */
  onModuleInit() {
    const intervalMs = Number(this.config?.get<string>("DOMAIN_EVENT_RELAY_INTERVAL_MS") ?? 30_000);
    if (!this.prisma || !this.config || !Number.isFinite(intervalMs) || intervalMs <= 0) {
      return;
    }
    this.relayTimer = setInterval(() => {
      void this.republishPending().catch((error: unknown) =>
        this.logger.warn(`domain event relay failed: ${error instanceof Error ? error.message : String(error)}`)
      );
    }, intervalMs);
    this.relayTimer.unref();
  }

  /**
   * Publishes stored events that never reached Kafka, oldest first. Consumers are idempotent, so an
   * event that was in fact delivered before the failure is skipped downstream.
   */
  async republishPending(options: { olderThanMs?: number; limit?: number } = {}) {
    if (!this.prisma) {
      return { published: 0, failed: 0 };
    }
    const pending = await this.prisma.client.domainEvent.findMany({
      where: { kafkaPublishedAt: null, createdAt: { lt: new Date(Date.now() - (options.olderThanMs ?? 10_000)) } },
      orderBy: { createdAt: "asc" },
      take: options.limit ?? 50
    });

    let published = 0;
    let failed = 0;
    for (const row of pending) {
      const event: EventEnvelope = {
        eventId: row.id,
        type: row.type as EventEnvelope["type"],
        workspaceId: row.workspaceId,
        workflowId: row.workflowId ?? undefined,
        workflowRunId: row.workflowRunId,
        requestId: row.requestId ?? undefined,
        traceId: row.traceId ?? undefined,
        traceparent: row.traceparent ?? undefined,
        parentEventId: row.parentEventId ?? undefined,
        timestamp: row.createdAt.toISOString(),
        payload: row.payloadJson as Record<string, unknown>
      };
      try {
        await this.publishToKafka(event);
        await this.markPublished(event.eventId);
        published += 1;
      } catch (error) {
        await this.markPublishFailed(event.eventId, error);
        failed += 1;
      }
    }
    if (pending.length > 0) {
      this.logger.log(JSON.stringify({ message: "domain event relay", published, failed }));
    }
    return { published, failed };
  }

  async onModuleDestroy() {
    if (this.relayTimer) {
      clearInterval(this.relayTimer);
    }
    if (!this.producer || !this.producerConnected) {
      return;
    }

    await this.producer.disconnect();
    this.producerConnected = false;
  }

  private async persistEvent(event: EventEnvelope) {
    if (!this.prisma) {
      return;
    }

    await this.prisma.client.domainEvent.create({
      data: {
        id: event.eventId,
        type: event.type,
        workspaceId: event.workspaceId,
        workflowId: event.workflowId,
        workflowRunId: event.workflowRunId,
        requestId: event.requestId,
        traceId: event.traceId,
        traceparent: event.traceparent,
        parentEventId: event.parentEventId,
        payloadJson: toInputJson(event.payload)
      }
    });
  }

  private async publishToKafka(event: EventEnvelope) {
    if (!this.config) {
      return;
    }

    const producer = await this.getConnectedProducer();
    await producer.send({
      topic: event.type,
      messages: [
        {
          key: event.workflowRunId,
          value: JSON.stringify(event),
          headers: {
            eventId: event.eventId,
            requestId: event.requestId ?? "",
            traceparent: event.traceparent ?? ""
          }
        }
      ]
    });
  }

  private async markPublished(eventId: string) {
    if (!this.prisma) {
      return;
    }

    await this.prisma.client.domainEvent.update({
      where: { id: eventId },
      data: {
        kafkaPublishedAt: new Date(),
        kafkaError: null
      }
    });
  }

  private async markPublishFailed(eventId: string, error: unknown) {
    if (!this.prisma) {
      return;
    }

    await this.prisma.client.domainEvent.update({
      where: { id: eventId },
      data: {
        kafkaError: error instanceof Error ? error.message : "Kafka publish failed"
      }
    });
  }

  private async getConnectedProducer() {
    if (!this.producer) {
      const kafka = new Kafka({
        brokers: parseKafkaBrokers(this.config?.get<string>("KAFKA_BROKERS") ?? "localhost:9094"),
        clientId: "agentops-api-producer",
        connectionTimeout: 2_000,
        logLevel: logLevel.ERROR,
        requestTimeout: 5_000
      });
      this.producer = kafka.producer();
    }

    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
    }

    return this.producer;
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
