import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AiModule } from "./modules/ai/ai.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthController } from "./modules/health.controller";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { WorkflowRunsModule } from "./modules/workflow-runs/workflow-runs.module";
import { WorkflowsModule } from "./modules/workflows/workflows.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";
import { DomainEventsModule } from "./common/domain-events/domain-events.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DomainEventsModule,
    AuthModule,
    WorkspacesModule,
    WorkflowsModule,
    WorkflowRunsModule,
    AiModule,
    WebhooksModule,
    DashboardModule,
    NotificationsModule,
    AuditModule
  ],
  controllers: [HealthController]
})
export class AppModule {}

