import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasRoleAtLeast, type WorkspaceRole } from "@agentops/shared";
import { AuthService } from "../../modules/auth/auth.service";
import { requestAuthorization } from "../auth/auth-cookies";
import { PrismaService } from "../infrastructure/prisma.service";
import { WORKSPACE_ROLES_KEY, WORKSPACE_SCOPE_KEY, type WorkspaceScopeSource } from "./workspace-role.decorator";

export type WorkspaceAuthenticatedUser = {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
};

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  user?: WorkspaceAuthenticatedUser;
};

/**
 * Enforces workspace roles from the authenticated JWT and the caller's workspace membership.
 * The legacy `x-workspace-role` header is ignored entirely: the role always comes from the
 * `WorkspaceMember` row for the resolved workspace.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    // Verifies the Bearer header or access cookie; a missing/invalid token propagates as 401.
    const caller = await this.auth.authenticate(requestAuthorization(request.headers));

    const workspaceId = await this.resolveWorkspaceId(context, request);
    const membership = await this.prisma.client.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: caller.userId } }
    });

    const role = membership?.role as WorkspaceRole | undefined;
    if (!role || !requiredRoles.some((required) => hasRoleAtLeast(role, required))) {
      throw new ForbiddenException(`Requires role ${requiredRoles.join(" or ")} or higher in this workspace`);
    }

    request.user = { userId: caller.userId, email: caller.email, workspaceId, role };
    return true;
  }

  private async resolveWorkspaceId(context: ExecutionContext, request: RequestLike): Promise<string> {
    const scope =
      this.reflector.getAllAndOverride<WorkspaceScopeSource>(WORKSPACE_SCOPE_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? "workspaceParam";

    if (scope === "workspaceParam") {
      const id = request.params?.id;
      if (!id) {
        throw new BadRequestException("No workspace can be resolved for this request");
      }
      return id;
    }

    if (scope === "workspaceQuery") {
      const id = request.query?.workspaceId;
      if (typeof id !== "string" || id.length === 0) {
        throw new BadRequestException("No workspace can be resolved for this request");
      }
      return id;
    }

    if (scope === "runParam") {
      const runId = request.params?.id;
      if (!runId) {
        throw new BadRequestException("No workspace can be resolved for this request");
      }
      const run = await this.prisma.client.workflowRun.findUnique({
        where: { id: runId },
        select: { workspaceId: true }
      });
      if (!run) {
        throw new NotFoundException("Workflow run not found");
      }
      return run.workspaceId;
    }

    const workflowId = request.params?.id;
    if (workflowId) {
      const workflow = await this.prisma.client.workflow.findUnique({
        where: { id: workflowId },
        select: { workspaceId: true }
      });
      if (!workflow) {
        throw new NotFoundException("Workflow not found");
      }
      return workflow.workspaceId;
    }

    const bodyWorkspaceId = request.body?.workspaceId;
    if (typeof bodyWorkspaceId === "string" && bodyWorkspaceId.length > 0) {
      return bodyWorkspaceId;
    }

    const queryWorkspaceId = request.query?.workspaceId;
    if (typeof queryWorkspaceId === "string" && queryWorkspaceId.length > 0) {
      return queryWorkspaceId;
    }

    throw new BadRequestException("No workspace can be resolved for this request");
  }
}
