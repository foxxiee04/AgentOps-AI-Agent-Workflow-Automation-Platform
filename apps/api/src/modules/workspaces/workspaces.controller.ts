import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles } from "../../common/rbac/workspace-role.decorator";
import { CreateWorkspaceDto, InviteWorkspaceMemberDto, UpdateWorkspaceDto, UpdateWorkspaceMemberRoleDto } from "./dto";
import { WorkspacesService } from "./workspaces.service";

@ApiTags("workspaces")
@UseGuards(WorkspaceRoleGuard)
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll() {
    return this.workspacesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(dto);
  }

  @Get(":id")
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
  members(@Param("id") id: string) {
    return this.workspacesService.membersForWorkspace(id);
  }

  @Patch(":id/members/:memberId/role")
  @WorkspaceRoles("OWNER")
  updateMemberRole(@Param("id") id: string, @Param("memberId") memberId: string, @Body() dto: UpdateWorkspaceMemberRoleDto) {
    return this.workspacesService.updateMemberRole(id, memberId, dto);
  }
}

