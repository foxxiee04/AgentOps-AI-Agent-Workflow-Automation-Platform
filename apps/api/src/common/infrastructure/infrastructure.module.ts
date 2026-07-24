import { Module } from "@nestjs/common";
import { DemoDataService } from "./demo-data.service";
import { KafkaAdminService } from "./kafka-admin.service";
import { PrismaService } from "./prisma.service";
import { RedisHealthService } from "./redis-health.service";

@Module({
  providers: [DemoDataService, KafkaAdminService, PrismaService, RedisHealthService],
  exports: [DemoDataService, KafkaAdminService, PrismaService, RedisHealthService]
})
export class InfrastructureModule {}
