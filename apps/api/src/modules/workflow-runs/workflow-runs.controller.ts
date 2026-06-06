import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkflowsService } from "../workflows/workflows.service";

@ApiTags("workflow-runs")
@Controller("workflow-runs")
export class WorkflowRunsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.workflowsService.findRun(id);
  }

  @Get(":id/steps")
  steps(@Param("id") id: string) {
    const run = this.workflowsService.findRun(id);
    return {
      workflowRunId: run.id,
      steps: [
        {
          nodeId: "trigger-1",
          status: "PENDING",
          message: "Step logs will be persisted by the workflow worker."
        }
      ]
    };
  }
}

