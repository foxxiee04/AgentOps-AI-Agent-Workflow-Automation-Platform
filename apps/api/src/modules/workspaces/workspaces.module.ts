import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { AuthModule } from "../auth/auth.module";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceRoleGuard],
  exports: [WorkspacesService]
})
export class WorkspacesModule {}
