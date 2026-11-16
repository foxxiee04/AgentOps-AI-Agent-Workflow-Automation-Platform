import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  type MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Observable } from "rxjs";
import { requestAuthorization } from "../../common/auth/auth-cookies";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles, WorkspaceScope } from "../../common/rbac/workspace-role.decorator";
import { WorkflowsService } from "../workflows/workflows.service";
import { ApprovalDecisionDto } from "./dto";
import { RunStreamService } from "./run-stream.service";
import { WorkflowRunsService } from "./workflow-runs.service";

type AuthenticatedRequest = {
  auth: AuthenticatedCaller;
};

@ApiTags("workflow-runs")
@UseGuards(WorkspaceRoleGuard)
@WorkspaceScope("runParam")
@Controller("workflow-runs")
export class WorkflowRunsController {
  constructor(
    @Inject(WorkflowsService) private readonly workflowsService: WorkflowsService,
    @Inject(WorkflowRunsService) private readonly runsService: WorkflowRunsService,
    @Inject(RunStreamService) private readonly runStream: RunStreamService
  ) {}

  @Get("approvals")
  approvals(
    @Req() request: AuthenticatedRequest,
    @Query("workspaceId") workspaceId?: string,
    @Query("status") status?: string
  ) {
    return this.runsService.listApprovals(workspaceId, status, request.auth.userId);
  }

  @Get(":id")
  @WorkspaceRoles("VIEWER")
  findOne(@Param("id") id: string) {
    return this.workflowsService.findRun(id);
  }

  @Get(":id/steps")
  @WorkspaceRoles("VIEWER")
  steps(@Param("id") id: string) {
    return this.workflowsService.stepsForRun(id);
  }

  @Sse(":id/stream")
  @WorkspaceRoles("VIEWER")
  stream(@Param("id") id: string): Observable<MessageEvent> {
    return this.runStream.stream(id);
  }

  @Post(":id/steps/:stepId/approval")
  @HttpCode(200)
  @ApiBearerAuth()
  decide(
    @Param("id") id: string,
    @Param("stepId") stepId: string,
    @Body() dto: ApprovalDecisionDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> }
  ) {
    return this.runsService.decideApproval(id, stepId, dto, requestAuthorization(request.headers));
  }
}
