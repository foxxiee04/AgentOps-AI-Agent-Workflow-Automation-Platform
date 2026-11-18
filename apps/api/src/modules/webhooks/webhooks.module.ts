import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { AuthModule } from "../auth/auth.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [InfrastructureModule, AuthModule, WorkflowsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WorkspaceRoleGuard]
})
export class WebhooksModule {}
