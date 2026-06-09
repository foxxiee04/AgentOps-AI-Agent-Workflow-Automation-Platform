import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../../common/domain-events/domain-events.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [DomainEventsModule, WorkflowsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
