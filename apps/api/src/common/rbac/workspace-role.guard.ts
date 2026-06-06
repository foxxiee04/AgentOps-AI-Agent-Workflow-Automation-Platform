import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasRoleAtLeast, workspaceRoleSchema, type WorkspaceRole } from "@agentops/shared";
import { WORKSPACE_ROLES_KEY } from "./workspace-role.decorator";

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const rawRole = request.headers["x-workspace-role"];
    const role = workspaceRoleSchema.catch("OWNER").parse(Array.isArray(rawRole) ? rawRole[0] : rawRole);

    return requiredRoles.some((required) => hasRoleAtLeast(role, required));
  }
}

