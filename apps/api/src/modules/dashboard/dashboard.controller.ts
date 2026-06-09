import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("overview")
  overview() {
    return this.dashboardService.overview();
  }

  @Get("workflow-runs")
  workflowRuns() {
    return this.dashboardService.workflowRuns();
  }

  @Get("usage")
  usage() {
    return this.dashboardService.usage();
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
