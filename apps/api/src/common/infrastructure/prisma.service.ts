import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPrismaClient, PrismaClient } from "@agentops/database";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(config: ConfigService) {
    this.client = createPrismaClient(config.get<string>("DATABASE_URL"));
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  async ping() {
    await this.client.$queryRaw`SELECT 1`;
  }
}
