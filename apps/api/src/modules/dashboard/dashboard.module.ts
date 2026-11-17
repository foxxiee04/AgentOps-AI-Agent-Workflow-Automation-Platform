import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../../common/domain-events/domain-events.module";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { AuthModule } from "../auth/auth.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [DomainEventsModule, InfrastructureModule, WorkflowsModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, WorkspaceRoleGuard]
})
export class DashboardModule {}
