import { Body, Controller, Get, Inject, Param, Patch, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles, WorkspaceScope } from "../../common/rbac/workspace-role.decorator";
import { DashboardService } from "./dashboard.service";
import { UpdateSalesTaskDto, WorkflowRunsQueryDto } from "./dto";

type AuthenticatedRequest = {
  auth: AuthenticatedCaller;
  user: { workspaceId: string };
};

@ApiTags("dashboard")
@UseGuards(WorkspaceRoleGuard)
@WorkspaceScope("workspaceQuery")
@WorkspaceRoles("VIEWER")
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("overview")
  overview(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.overview(request.user.workspaceId);
  }

  /**
   * Paged run list. The body stays an array for the web app; `X-Total-Count` carries the number of
   * rows matching the filters. Browsers cannot read that header until CORS exposes it, so
   * `GET /dashboard/workflow-runs/count` returns the same total as JSON.
   */
  @Get("workflow-runs")
  async workflowRuns(
    @Req() request: AuthenticatedRequest,
    @Query() query: WorkflowRunsQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const { items, total } = await this.dashboardService.workflowRuns(request.user.workspaceId, query);
    response.setHeader("X-Total-Count", String(total));
    return items;
  }

  @Get("workflow-runs/count")
  countWorkflowRuns(@Req() request: AuthenticatedRequest, @Query() query: WorkflowRunsQueryDto) {
    return this.dashboardService.countWorkflowRuns(request.user.workspaceId, query);
  }

  @Get("usage")
  usage(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.usage(request.user.workspaceId);
  }

  @Get("leads")
  leads(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.leads(request.user.workspaceId);
  }

  @Get("sales-tasks")
  salesTasks(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.salesTasks(request.user.workspaceId);
  }

  @Patch("sales-tasks/:id")
  @WorkspaceRoles("MEMBER")
  updateSalesTask(
    @Param("id") id: string,
    @Body() dto: UpdateSalesTaskDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.dashboardService.updateSalesTask(id, dto, request.auth.userId, request.user.workspaceId);
  }

  @Get("errors")
  errors(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.errors(request.user.workspaceId);
  }

  @Get("recent-activity")
  recentActivity(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.recentActivity(request.user.workspaceId);
  }

  @Get("readiness")
  readiness(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.readiness(request.user.workspaceId);
  }
}
