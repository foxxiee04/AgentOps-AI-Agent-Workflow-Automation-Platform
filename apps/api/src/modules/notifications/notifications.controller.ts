import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
  alertmanager(@Body() payload: Record<string, unknown>) {
    return this.notificationsService.ingestAlertmanagerWebhook(payload);
  }
}
