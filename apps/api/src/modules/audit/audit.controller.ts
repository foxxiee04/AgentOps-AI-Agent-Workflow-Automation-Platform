import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles, WorkspaceScope } from "../../common/rbac/workspace-role.decorator";
import { AuditService } from "./audit.service";
import { AuditLogsQueryDto } from "./dto";

@ApiTags("audit")
@UseGuards(WorkspaceRoleGuard)
@WorkspaceScope("workspaceQuery")
@WorkspaceRoles("ADMIN")
@Controller("audit-logs")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @WorkspaceRoles("ADMIN")
  findAll(@Query() query: AuditLogsQueryDto) {
    return this.auditService.list(query.workspaceId, query);
  }
}
