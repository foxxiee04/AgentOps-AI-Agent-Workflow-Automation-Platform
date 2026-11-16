import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles, WorkspaceScope } from "../../common/rbac/workspace-role.decorator";
import { CreateWorkflowDto, RunWorkflowDto, UpdateWorkflowDto } from "./dto";
import { WorkflowsService } from "./workflows.service";

type AuthenticatedRequest = {
  auth: AuthenticatedCaller;
};

@ApiTags("workflows")
@UseGuards(WorkspaceRoleGuard)
@WorkspaceScope("workflowParamOrBody")
@Controller("workflows")
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly workflowsService: WorkflowsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query("workspaceId") workspaceId?: string,
    @Query("includeArchived") includeArchived?: string
  ) {
    return this.workflowsService.findAll(workspaceId, request.auth.userId, includeArchived === "true");
  }

  @Post()
  @WorkspaceRoles("MEMBER")
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(dto);
  }

  @Get(":id")
  @WorkspaceRoles("VIEWER")
  findOne(@Param("id") id: string) {
    return this.workflowsService.findOne(id);
  }

  @Patch(":id")
  @WorkspaceRoles("MEMBER")
  update(@Param("id") id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflowsService.update(id, dto);
  }

  @Delete(":id")
  @WorkspaceRoles("ADMIN")
  remove(@Param("id") id: string) {
    return this.workflowsService.remove(id);
  }

  @Post(":id/publish")
  @WorkspaceRoles("ADMIN")
  publish(@Param("id") id: string) {
    return this.workflowsService.publish(id);
  }

  @Post(":id/run")
  @WorkspaceRoles("MEMBER")
  run(@Param("id") id: string, @Body() dto: RunWorkflowDto) {
    return this.workflowsService.run(id, dto);
  }

  @Get(":id/runs")
  @WorkspaceRoles("VIEWER")
  runs(@Param("id") id: string) {
    return this.workflowsService.runsForWorkflow(id);
  }
}
