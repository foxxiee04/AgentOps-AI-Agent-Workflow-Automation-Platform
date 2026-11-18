import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { WorkspaceRoleGuard } from "../../common/rbac/workspace-role.guard";
import { AuthModule } from "../auth/auth.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [AuditController],
  providers: [AuditService, WorkspaceRoleGuard]
})
export class AuditModule {}
