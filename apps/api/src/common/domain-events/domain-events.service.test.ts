import { describe, expect, it, vi, beforeEach } from "vitest";

const kafkaSend = vi.fn();
vi.mock("kafkajs", () => ({
  logLevel: { ERROR: 1 },
  Kafka: class {
    producer() {
      return { connect: vi.fn(async () => undefined), disconnect: vi.fn(async () => undefined), send: kafkaSend };
    }
  }
}));

const { DomainEventsService } = await import("./domain-events.service");

type Row = { id: string; kafkaPublishedAt: Date | null; kafkaError: string | null; createdAt: Date; [key: string]: unknown };

function createHarness() {
  const rows: Row[] = [];
  const calls: string[] = [];
  const prisma = {
    client: {
      domainEvent: {
        create: vi.fn(async ({ data }: { data: Row }) => {
          calls.push("persist");
          rows.push({ ...data, kafkaPublishedAt: null, kafkaError: null, createdAt: new Date() });
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
          calls.push(data.kafkaPublishedAt ? "markPublished" : "markFailed");
          Object.assign(rows.find((row) => row.id === where.id)!, data);
        }),
        findMany: vi.fn(async () => rows.filter((row) => row.kafkaPublishedAt === null))
      }
    }
  };
  const config = { get: vi.fn(() => undefined) };
  const service = new DomainEventsService(prisma as never, config as never);
  kafkaSend.mockImplementation(async () => {
    calls.push("send");
  });
  return { service, rows, calls };
}

const input = { type: "workflow-triggered" as const, workspaceId: "ws_demo", workflowRunId: "run_1", payload: { input: {} } };

describe("DomainEventsService", () => {
  beforeEach(() => kafkaSend.mockReset());

  it("stores the event before sending it to Kafka, then records kafkaPublishedAt", async () => {
    const { service, rows, calls } = createHarness();

    const event = await service.publish(input);

    expect(calls).toEqual(["persist", "send", "markPublished"]);
    expect(rows[0]).toMatchObject({ id: event.eventId, kafkaError: null });
    expect(rows[0]?.kafkaPublishedAt).toBeInstanceOf(Date);
    expect(kafkaSend).toHaveBeenCalledWith(expect.objectContaining({ topic: "workflow-triggered" }));
  });

  it("keeps the stored event with kafkaError when Kafka is down", async () => {
    const { service, rows, calls } = createHarness();
    kafkaSend.mockImplementationOnce(async () => {
      calls.push("send");
      throw new Error("broker unavailable");
    });

    await expect(service.publish(input)).rejects.toThrow("broker unavailable");

    expect(calls).toEqual(["persist", "send", "markFailed"]);
    expect(rows[0]).toMatchObject({ kafkaPublishedAt: null, kafkaError: "broker unavailable" });
  });

  it("relays events that never reached Kafka", async () => {
    const { service, rows } = createHarness();
    kafkaSend.mockImplementationOnce(async () => {
      throw new Error("broker unavailable");
    });
    await service.publish(input).catch(() => undefined);

    const result = await service.republishPending({ olderThanMs: 0 });

    expect(result).toEqual({ published: 1, failed: 0 });
    expect(rows[0]?.kafkaPublishedAt).toBeInstanceOf(Date);
    expect(kafkaSend).toHaveBeenLastCalledWith(
      expect.objectContaining({ topic: "workflow-triggered", messages: [expect.objectContaining({ key: "run_1" })] })
    );
  });
});
