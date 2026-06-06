import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  @Get()
  findAll() {
    return [
      {
        id: "notif_demo",
        title: "Workflow ready",
        body: "Your Lead qualification workflow is ready to publish.",
        status: "UNREAD"
      }
    ];
  }

  @Post("mark-all-read")
  markAllRead() {
    return { success: true };
  }
}

