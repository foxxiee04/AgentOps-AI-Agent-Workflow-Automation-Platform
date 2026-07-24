import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../../common/domain-events/domain-events.module";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsService } from "./workflows.service";

@Module({
  imports: [DomainEventsModule, InfrastructureModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkspaceRoleGuard],
  exports: [WorkflowsService]
})
export class WorkflowsModule {}
