import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../../common/domain-events/domain-events.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { DashboardController } from "./dashboard.controller";

@Module({
  imports: [DomainEventsModule, WorkflowsModule],
  controllers: [DashboardController]
})
export class DashboardModule {}

