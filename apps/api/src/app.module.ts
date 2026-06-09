import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { parseAppEnv } from "@agentops/config";
import { DomainEventsModule } from "./common/domain-events/domain-events.module";
import { InfrastructureModule } from "./common/infrastructure/infrastructure.module";
import { RequestLoggingMiddleware } from "./common/http/request-logging.middleware";
import { RequestIdMiddleware } from "./common/http/request-id.middleware";
import { AiModule } from "./modules/ai/ai.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { WorkflowRunsModule } from "./modules/workflow-runs/workflow-runs.module";
import { WorkflowsModule } from "./modules/workflows/workflows.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: parseAppEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    InfrastructureModule,
    DomainEventsModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    WorkspacesModule,
    WorkflowsModule,
    WorkflowRunsModule,
    AiModule,
    WebhooksModule,
    DashboardModule,
    NotificationsModule,
    AuditModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RequestLoggingMiddleware).forRoutes("*");
  }
}
