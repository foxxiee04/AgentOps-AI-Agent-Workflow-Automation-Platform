import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { workflowRunStatusSchema, type WorkflowRunStatus } from "@agentops/shared";

/** Every status a WorkflowRun can be in; used to validate the `status` query filter. */
export const workflowRunStatuses = workflowRunStatusSchema.options;

export const DEFAULT_WORKFLOW_RUN_LIMIT = 50;
export const MAX_WORKFLOW_RUN_LIMIT = 200;

/** Query filters for the dashboard run list and the matching total-count endpoint. */
export class WorkflowRunsQueryDto {
  @IsString()
  @MinLength(1)
  workspaceId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_WORKFLOW_RUN_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(workflowRunStatuses)
  status?: WorkflowRunStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  workflowId?: string;
}

/** Marks a sales task as handled (`DONE`) or re-opens it (`OPEN`). */
export class UpdateSalesTaskDto {
  @IsIn(["DONE", "OPEN"])
  status!: "DONE" | "OPEN";
}
