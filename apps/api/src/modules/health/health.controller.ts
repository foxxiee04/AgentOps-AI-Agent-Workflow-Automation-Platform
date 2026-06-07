import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult
} from "@nestjs/terminus";
import { KafkaAdminService } from "../../common/infrastructure/kafka-admin.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { RedisHealthService } from "../../common/infrastructure/redis-health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisHealthService,
    private readonly kafka: KafkaAdminService
  ) {}

  @Get("live")
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([async () => ({ api: { status: "up" } })]);
  }

  @Get("ready")
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDependency("postgres", () => this.prisma.ping()),
      () => this.checkDependency("redis", () => this.redis.ping()),
      () => this.checkDependency("kafka", () => this.kafka.ping())
    ]);
  }

  private async checkDependency(key: string, ping: () => Promise<void>): Promise<HealthIndicatorResult> {
    try {
      await ping();
      return { [key]: { status: "up" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown dependency error";
      const result = { [key]: { status: "down", message } };
      throw new HealthCheckError(`${key} is not ready`, result);
    }
  }
}
