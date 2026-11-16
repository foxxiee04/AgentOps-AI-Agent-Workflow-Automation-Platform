import { Body, Controller, Get, Inject, Param, Patch, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";
import { UpdateSalesTaskDto, WorkflowRunsQueryDto } from "./dto";

type AuthenticatedRequest = {
  auth: AuthenticatedCaller;
};

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("overview")
  overview() {
    return this.dashboardService.overview();
  }

  /**
   * Paged run list. The body stays an array for the web app; `X-Total-Count` carries the number of
   * rows matching the filters. Browsers cannot read that header until CORS exposes it, so
   * `GET /dashboard/workflow-runs/count` returns the same total as JSON.
   */
  @Get("workflow-runs")
  async workflowRuns(@Query() query: WorkflowRunsQueryDto, @Res({ passthrough: true }) response: Response) {
    const { items, total } = await this.dashboardService.workflowRuns(query);
    response.setHeader("X-Total-Count", String(total));
    return items;
  }

  @Get("workflow-runs/count")
  countWorkflowRuns(@Query() query: WorkflowRunsQueryDto) {
    return this.dashboardService.countWorkflowRuns(query);
  }

  @Get("usage")
  usage() {
    return this.dashboardService.usage();
  }

  @Get("leads")
  leads() {
    return this.dashboardService.leads();
  }

  @Get("sales-tasks")
  salesTasks() {
    return this.dashboardService.salesTasks();
  }

  @Patch("sales-tasks/:id")
  updateSalesTask(
    @Param("id") id: string,
    @Body() dto: UpdateSalesTaskDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.dashboardService.updateSalesTask(id, dto, request.auth.userId);
  }

  @Get("errors")
  errors() {
    return this.dashboardService.errors();
  }

  @Get("recent-activity")
  recentActivity() {
    return this.dashboardService.recentActivity();
  }

  @Get("readiness")
  readiness() {
    return this.dashboardService.readiness();
  }
}
