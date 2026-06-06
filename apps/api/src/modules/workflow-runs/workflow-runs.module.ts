import { Module } from "@nestjs/common";
import { WorkflowsModule } from "../workflows/workflows.module";
import { WorkflowRunsController } from "./workflow-runs.controller";

@Module({
  imports: [WorkflowsModule],
  controllers: [WorkflowRunsController]
})
export class WorkflowRunsModule {}

