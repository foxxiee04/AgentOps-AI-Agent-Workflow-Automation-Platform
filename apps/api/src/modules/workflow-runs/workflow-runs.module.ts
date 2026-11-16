import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../../common/domain-events/domain-events.module";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { AuthModule } from "../auth/auth.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { RunStreamService } from "./run-stream.service";
import { WorkflowRunsController } from "./workflow-runs.controller";
import { WorkflowRunsService } from "./workflow-runs.service";

@Module({
  imports: [WorkflowsModule, AuthModule, DomainEventsModule, InfrastructureModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService, RunStreamService, WorkspaceRoleGuard]
})
export class WorkflowRunsModule {}
