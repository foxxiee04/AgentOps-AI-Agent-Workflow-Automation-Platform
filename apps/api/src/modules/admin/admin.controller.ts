import { BadRequestException, Body, Controller, Get, Header, Inject, Param, Patch, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { AdminService } from "./admin.service";
import { AuditQueryDto, PageQueryDto, RangeQueryDto, REPORT_TYPES, type ReportType, UpdateUserDto, UsersQueryDto } from "./dto";
import { PlatformAdminGuard } from "./platform-admin.guard";

type AuthenticatedRequest = { auth: AuthenticatedCaller };

/** Platform admin console API. Every route requires a platform administrator. */
@ApiTags("admin")
@UseGuards(PlatformAdminGuard)
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  overview(@Query() query: RangeQueryDto) {
    return this.admin.overview(query.days ?? 30);
  }

  @Get("users")
  users(@Query() query: UsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get("users/:id")
  user(@Param("id") id: string) {
    return this.admin.getUser(id);
  }

  @Patch("users/:id")
  updateUser(@Param("id") id: string, @Body() dto: UpdateUserDto, @Req() request: AuthenticatedRequest) {
    return this.admin.updateUser(request.auth.userId, id, dto);
  }

  @Get("workspaces")
  workspaces(@Query() query: PageQueryDto) {
    return this.admin.listWorkspaces(query);
  }

  @Get("audit")
  audit(@Query() query: AuditQueryDto) {
    return this.admin.listAudit(query);
  }

  @Get("reports/:file")
  @Header("Cache-Control", "no-store")
  async report(@Param("file") file: string, @Query() query: RangeQueryDto, @Res({ passthrough: true }) response: Response) {
    const type = file.replace(/\.csv$/, "") as ReportType;
    if (!file.endsWith(".csv") || !REPORT_TYPES.includes(type)) {
      throw new BadRequestException(`Unknown report; use one of ${REPORT_TYPES.map((name) => `${name}.csv`).join(", ")}`);
    }

    const days = query.days ?? 30;
    const stamp = new Date().toISOString().slice(0, 10);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="agentops-${type}-${days}d-${stamp}.csv"`);
    return this.admin.report(type, days);
  }
}
