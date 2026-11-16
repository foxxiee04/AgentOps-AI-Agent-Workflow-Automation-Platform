import { Body, Controller, Get, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/public.decorator";
import { isAlertmanagerRequestAllowed } from "./alertmanager-token";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Post("mark-all-read")
  markAllRead() {
    return this.notificationsService.markAllRead();
  }

  @Post("alertmanager")
  @Public()
  alertmanager(
    @Body() payload: Record<string, unknown>,
    @Headers("authorization") authorization?: string
  ) {
    if (!isAlertmanagerRequestAllowed(authorization, process.env.ALERTMANAGER_WEBHOOK_TOKEN, process.env.APP_ENV ?? "local")) {
      throw new UnauthorizedException("Invalid Alertmanager token");
    }

    return this.notificationsService.ingestAlertmanagerWebhook(payload);
  }
}
