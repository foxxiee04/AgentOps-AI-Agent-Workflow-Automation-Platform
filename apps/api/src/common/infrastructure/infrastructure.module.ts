import { Module } from "@nestjs/common";
import { KafkaAdminService } from "./kafka-admin.service";
import { PrismaService } from "./prisma.service";
import { RedisHealthService } from "./redis-health.service";

@Module({
  providers: [KafkaAdminService, PrismaService, RedisHealthService],
  exports: [KafkaAdminService, PrismaService, RedisHealthService]
})
export class InfrastructureModule {}
