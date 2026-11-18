import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { PlatformAdminGuard } from "../admin/platform-admin.guard";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PlatformAdminGuard]
})
export class NotificationsModule {}
