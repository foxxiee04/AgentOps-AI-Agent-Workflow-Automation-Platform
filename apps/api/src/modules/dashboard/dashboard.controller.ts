import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { WorkflowsService } from "../workflows/workflows.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly eventsService: DomainEventsService
  ) {}

  @Get("overview")
  overview() {
    const workflows = this.workflowsService.findAll("ws_demo");
    const runs = this.workflowsService.listRuns();
    return {
      activeWorkflows: workflows.filter((workflow) => workflow.status === "ACTIVE").length,
      totalWorkflows: workflows.length,
      runsToday: runs.length,
      failedRuns: runs.filter((run) => run.status === "FAILED").length,
      aiTokensUsed: 0
    };
  }

  @Get("workflow-runs")
  workflowRuns() {
    return this.workflowsService.listRuns();
  }

  @Get("usage")
  usage() {
    return { aiTokensUsed: 0, workflowStepsExecuted: 0, plan: "FREE" };
  }

  @Get("errors")
  errors() {
    return [];
  }

  @Get("recent-activity")
  recentActivity() {
    return this.eventsService.listRecent();
  }
}

