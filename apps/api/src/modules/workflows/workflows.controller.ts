import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles } from "../../common/rbac/workspace-role.decorator";
import { CreateWorkflowDto, RunWorkflowDto, UpdateWorkflowDto } from "./dto";
import { WorkflowsService } from "./workflows.service";

@ApiTags("workflows")
@UseGuards(WorkspaceRoleGuard)
@Controller("workflows")
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  findAll(@Query("workspaceId") workspaceId?: string) {
    return this.workflowsService.findAll(workspaceId);
  }

  @Post()
  @WorkspaceRoles("MEMBER")
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(dto);
  }

  @Get(":id")
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
  runs(@Param("id") id: string) {
    return this.workflowsService.runsForWorkflow(id);
  }
}

