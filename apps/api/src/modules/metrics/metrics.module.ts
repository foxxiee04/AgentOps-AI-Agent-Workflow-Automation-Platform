import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { MetricsController } from "./metrics.controller";

@Module({
  imports: [InfrastructureModule],
  controllers: [MetricsController]
})
export class MetricsModule {}
