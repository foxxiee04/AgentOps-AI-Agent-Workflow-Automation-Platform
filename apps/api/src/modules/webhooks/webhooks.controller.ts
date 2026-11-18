import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { Public } from "../../common/auth/public.decorator";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { WorkspaceRoles, WorkspaceScope } from "../../common/rbac/workspace-role.decorator";
import { CreateWebhookDto } from "./dto";
import { WebhooksService } from "./webhooks.service";

type AuthenticatedRequest = {
  auth: AuthenticatedCaller;
  user?: { workspaceId: string };
};

@ApiTags("webhooks")
@UseGuards(WorkspaceRoleGuard)
@Controller("webhooks")
export class WebhooksController {
  constructor(@Inject(WebhooksService) private readonly webhooksService: WebhooksService) {}

  /**
   * Inbound trigger for external systems. It is public (no JWT) and cookie-less, so the CSRF
   * Origin check does not apply; callers authenticate with `x-agentops-webhook-secret` instead.
   */
  @Post(":id")
  @Public()
  @HttpCode(202)
  receive(
    @Param("id") id: string,
    @Headers("x-agentops-webhook-secret") secret: string | undefined,
    @Body() body: unknown
  ) {
    return this.webhooksService.receive(id, secret, body);
  }

  @Get()
  @WorkspaceScope("workspaceQuery")
  @WorkspaceRoles("VIEWER")
  findAll(@Req() request: AuthenticatedRequest) {
    if (!request.user) {
      throw new BadRequestException("No workspace can be resolved for this request");
    }

    return this.webhooksService.list(request.user.workspaceId);
  }

  @Post()
  create(@Body() dto: CreateWebhookDto, @Req() request: AuthenticatedRequest) {
    return this.webhooksService.create(dto.workflowId, request.auth.userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.webhooksService.deactivate(id, request.auth.userId);
  }
}
