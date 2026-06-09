import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkflowsService } from "../workflows/workflows.service";

@ApiTags("workflow-runs")
@Controller("workflow-runs")
export class WorkflowRunsController {
  constructor(@Inject(WorkflowsService) private readonly workflowsService: WorkflowsService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.workflowsService.findRun(id);
  }

  @Get(":id/steps")
  steps(@Param("id") id: string) {
    return this.workflowsService.stepsForRun(id);
  }
}
