import { Prisma, type PrismaClient } from "./generated/prisma/client";

/** Prisma-backed consumer idempotency; the unique (consumerGroup, idempotencyKey) index is the lock. */
export class PrismaProcessedMessageStore {
  constructor(private readonly prisma: Pick<PrismaClient, "processedMessage">) {}

  async isProcessed(consumerGroup: string, idempotencyKey: string): Promise<boolean> {
    const existing = await this.prisma.processedMessage.findUnique({
      where: { consumerGroup_idempotencyKey: { consumerGroup, idempotencyKey } },
      select: { id: true }
    });
    return existing !== null;
  }

  async markProcessed(consumerGroup: string, idempotencyKey: string, eventId: string, outcome: string): Promise<void> {
    try {
      await this.prisma.processedMessage.create({ data: { consumerGroup, idempotencyKey, eventId, outcome } });
    } catch (error) {
      // A concurrent duplicate already recorded it; that is the desired end state.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return;
      }
      throw error;
    }
  }
}
