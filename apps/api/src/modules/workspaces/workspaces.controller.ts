import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles, WorkspaceScope } from "../../common/rbac/workspace-role.decorator";
import { CreateWorkspaceDto, InviteWorkspaceMemberDto, UpdateWorkspaceDto, UpdateWorkspaceMemberRoleDto } from "./dto";
import { WorkspacesService } from "./workspaces.service";

type AuthenticatedRequest = {
  auth: AuthenticatedCaller;
};

@ApiTags("workspaces")
@UseGuards(WorkspaceRoleGuard)
@WorkspaceScope("workspaceParam")
@Controller("workspaces")
export class WorkspacesController {
  constructor(@Inject(WorkspacesService) private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.workspacesService.findAll(request.auth.userId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(dto, request.auth.userId);
  }

  @Get(":id")
  @WorkspaceRoles("VIEWER")
  findOne(@Param("id") id: string) {
    return this.workspacesService.findOne(id);
  }

  @Patch(":id")
  @WorkspaceRoles("ADMIN")
  update(@Param("id") id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspacesService.update(id, dto);
  }

  @Post(":id/invite")
  @WorkspaceRoles("ADMIN")
  invite(@Param("id") id: string, @Body() dto: InviteWorkspaceMemberDto) {
    return this.workspacesService.invite(id, dto);
  }

  @Get(":id/members")
  @WorkspaceRoles("VIEWER")
  members(@Param("id") id: string) {
    return this.workspacesService.membersForWorkspace(id);
  }

  @Patch(":id/members/:memberId/role")
  @WorkspaceRoles("OWNER")
  updateMemberRole(@Param("id") id: string, @Param("memberId") memberId: string, @Body() dto: UpdateWorkspaceMemberRoleDto) {
    return this.workspacesService.updateMemberRole(id, memberId, dto);
  }
}
