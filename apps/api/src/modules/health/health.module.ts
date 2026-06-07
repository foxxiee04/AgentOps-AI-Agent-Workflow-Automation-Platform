import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [InfrastructureModule, TerminusModule],
  controllers: [HealthController]
})
export class HealthModule {}
