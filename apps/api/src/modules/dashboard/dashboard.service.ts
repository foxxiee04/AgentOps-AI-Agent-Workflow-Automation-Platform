import { Inject, Injectable } from "@nestjs/common";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { DemoDataService, demoWorkspaceId } from "../../common/infrastructure/demo-data.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { WorkflowsService } from "../workflows/workflows.service";

export type ReadinessStatus = "ready" | "warning" | "blocked" | "planned";

export type ReadinessItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  summary: string;
  action: string;
};

@Injectable()
export class DashboardService {
  constructor(
    @Inject(WorkflowsService) private readonly workflowsService: WorkflowsService,
    @Inject(DomainEventsService) private readonly eventsService: DomainEventsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoDataService) private readonly demoData: DemoDataService
  ) {}

  async overview() {
    const workflows = await this.workflowsService.findAll("ws_demo");
    const runs = await this.workflowsService.listRuns();
    const usage = await this.usageSnapshot();
    return {
      activeWorkflows: workflows.filter((workflow) => workflow.status === "ACTIVE").length,
      totalWorkflows: workflows.length,
      runsToday: runs.length,
      failedRuns: runs.filter((run) => run.status === "FAILED").length,
      aiTokensUsed: usage.aiTokensUsed
    };
  }

  async workflowRuns() {
    return this.workflowsService.listRuns();
  }

  async usage() {
    const usage = await this.usageSnapshot();
    const workspace = await this.prisma.client.workspace.findUnique({ where: { id: demoWorkspaceId } });
    return { ...usage, plan: workspace?.plan ?? "FREE" };
  }

  async errors() {
    return [];
  }

  async recentActivity() {
    return this.eventsService.listRecent();
  }

  async readiness() {
    const workflows = await this.workflowsService.findAll("ws_demo");
    const activeWorkflows = workflows.filter((workflow) => workflow.status === "ACTIVE").length;
    const events = await this.eventsService.listRecent();
    const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
    const otelEnabled = process.env.OTEL_ENABLED === "true";
    const production = process.env.NODE_ENV === "production";
    const weakSecrets = this.hasWeakSecret(process.env.JWT_ACCESS_SECRET) || this.hasWeakSecret(process.env.JWT_REFRESH_SECRET);

    const items: ReadinessItem[] = [
      {
        id: "workflow-publishing",
        label: "Workflow publishing",
        status: activeWorkflows > 0 ? "ready" : "warning",
        summary:
          activeWorkflows > 0
            ? `${activeWorkflows} workflow is active and can be triggered.`
            : "No active workflow is available for live demo runs yet.",
        action:
          activeWorkflows > 0
            ? "Keep published workflow versions immutable and create new versions for edits."
            : "Publish the lead qualification workflow and run it once from the Workflows screen."
      },
      {
        id: "event-pipeline",
        label: "Event pipeline",
        status: events.length > 0 ? "ready" : "warning",
        summary:
          events.length > 0
            ? `${events.length} recent domain event(s) are available for correlation.`
            : "No recent domain events have been recorded in memory.",
        action:
          events.length > 0
            ? "Use eventId and traceparent to follow API-to-worker execution."
            : "Trigger a workflow run to verify Kafka event publishing and worker logs."
      },
      {
        id: "ai-provider",
        label: "AI provider",
        status: openAiConfigured || geminiConfigured ? "ready" : "warning",
        summary:
          openAiConfigured || geminiConfigured
            ? "At least one real AI provider key is configured."
            : "Only the mock AI provider is ready; real provider execution is not configured.",
        action:
          openAiConfigured || geminiConfigured
            ? "Track AI calls and token usage by workspace before enabling quotas."
            : "Set OPENAI_API_KEY or GEMINI_API_KEY when moving beyond mock lead scoring."
      },
      {
        id: "observability",
        label: "Observability",
        status: otelEnabled ? "ready" : "warning",
        summary: otelEnabled ? "OpenTelemetry export is enabled for API and worker traces." : "OpenTelemetry export is disabled.",
        action: otelEnabled
          ? "Keep Prometheus, Grafana, Tempo, and request IDs aligned during smoke tests."
          : "Set OTEL_ENABLED=true and OTEL_EXPORTER_OTLP_TRACES_ENDPOINT for local Tempo traces."
      },
      {
        id: "production-secrets",
        label: "Production secrets",
        status: production && weakSecrets ? "blocked" : weakSecrets ? "warning" : "ready",
        summary:
          production && weakSecrets
            ? "JWT secrets are still using placeholder values in production."
            : weakSecrets
              ? "JWT secrets look like local placeholder values."
              : "JWT secrets are configured with non-placeholder values.",
        action:
          production && weakSecrets
            ? "Replace JWT_ACCESS_SECRET and JWT_REFRESH_SECRET before deploying."
            : weakSecrets
              ? "Generate strong JWT_ACCESS_SECRET and JWT_REFRESH_SECRET for staging and production."
              : "Rotate secrets through the deployment secret manager on a regular schedule."
      }
    ];

    return {
      generatedAt: new Date().toISOString(),
      workspaceId: "ws_demo",
      summary: {
        ready: items.filter((item) => item.status === "ready").length,
        warning: items.filter((item) => item.status === "warning").length,
        blocked: items.filter((item) => item.status === "blocked").length,
        planned: items.filter((item) => item.status === "planned").length
      },
      items,
      nextActions: items.filter((item) => item.status !== "ready").map((item) => item.action)
    };
  }

  private hasWeakSecret(value: string | undefined) {
    return !value || value.startsWith("replace-me") || value.length < 16;
  }

  private async usageSnapshot() {
    await this.demoData.ensureDemoWorkspace();
    const records = await this.prisma.client.usageRecord.findMany({
      where: {
        workspaceId: demoWorkspaceId,
        createdAt: {
          gte: this.startOfUtcDay()
        }
      }
    });

    return {
      aiTokensUsed: records.reduce((sum, record) => sum + record.aiTokensUsed, 0),
      workflowStepsExecuted: records.reduce((sum, record) => sum + record.workflowStepsExecuted, 0)
    };
  }

  private startOfUtcDay() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
