import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private client: Redis | undefined;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async ping() {
    const client = await this.getClient();
    const response = await client.ping();

    if (response !== "PONG") {
      throw new Error(`Redis ping returned ${response}`);
    }
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private async getClient() {
    if (!this.client || this.client.status === "end") {
      this.client = new Redis(this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379", {
        commandTimeout: 2_000,
        connectTimeout: 2_000,
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      });
    }

    if (this.client.status === "wait" || this.client.status === "close") {
      await this.client.connect();
    }

    return this.client;
  }
}
