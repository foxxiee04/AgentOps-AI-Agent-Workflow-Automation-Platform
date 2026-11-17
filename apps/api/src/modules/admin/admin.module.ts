import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { PlatformAdminGuard } from "./platform-admin.guard";

@Module({
  imports: [InfrastructureModule],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminGuard]
})
export class AdminModule {}
