import { Module } from "@nestjs/common";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceRoleGuard],
  exports: [WorkspacesService]
})
export class WorkspacesModule {}
