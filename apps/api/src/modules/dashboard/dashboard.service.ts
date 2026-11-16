import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  hasRoleAtLeast,
  maskSensitivePromptInput,
  type LeadSummaryView,
  type SalesTaskView,
  type WorkflowRunStatus,
  type WorkflowRunView,
  type WorkspaceRole
} from "@agentops/shared";
import { DomainEventsService } from "../../common/domain-events/domain-events.service";
import { DemoDataService, demoWorkspaceId } from "../../common/infrastructure/demo-data.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { WorkflowsService } from "../workflows/workflows.service";
import { DEFAULT_WORKFLOW_RUN_LIMIT, type UpdateSalesTaskDto, type WorkflowRunsQueryDto } from "./dto";

export type ReadinessStatus = "ready" | "warning" | "blocked" | "planned";

export type ReadinessItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  summary: string;
  action: string;
};

/** A workflow run enriched with the workflow name so the UI never has to resolve ids. */
export type DashboardWorkflowRunView = WorkflowRunView & { workflowName: string };

/** Sales task state as the dashboard shows it: the stored notification status is normalised. */
export type DashboardSalesTaskView = Omit<SalesTaskView, "status"> & {
  status: "OPEN" | "DONE";
  overdue: boolean;
};

type WorkflowRunRow = {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  workspaceId: string;
  status: string;
  triggerType: string;
  inputJson: unknown;
  triggerEventId: string | null;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  errorMessage?: string | null;
  workflow?: { name: string } | null;
};

type NotificationRow = {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  body: string;
  status: string;
  metadataJson: unknown;
  createdAt: Date;
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
    const usage = await this.usageSnapshot();
    const since = this.startOfUtcDay();
    const [runsToday, failedRuns] = await Promise.all([
      this.prisma.client.workflowRun.count({ where: { createdAt: { gte: since } } }),
      this.prisma.client.workflowRun.count({ where: { status: "FAILED", createdAt: { gte: since } } })
    ]);
    return {
      activeWorkflows: workflows.filter((workflow) => workflow.status === "ACTIVE").length,
      totalWorkflows: workflows.length,
      runsToday,
      failedRuns,
      aiTokensUsed: usage.aiTokensUsed
    };
  }

  /**
   * Paged run list for the dashboard. The response stays an array (the web app parses it that way)
   * and the total number of matching rows is returned alongside it so the UI can paginate.
   */
  async workflowRuns(query: WorkflowRunsQueryDto = {}): Promise<{ items: DashboardWorkflowRunView[]; total: number }> {
    const where = this.workflowRunWhere(query);
    const limit = Number.isInteger(query.limit) ? (query.limit as number) : DEFAULT_WORKFLOW_RUN_LIMIT;
    const offset = Number.isInteger(query.offset) ? (query.offset as number) : 0;

    const [runs, total] = await Promise.all([
      this.prisma.client.workflowRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: { workflow: { select: { name: true } } }
      }),
      this.prisma.client.workflowRun.count({ where })
    ]);

    return { items: runs.map((run) => this.toDashboardWorkflowRun(run as WorkflowRunRow)), total };
  }

  /** Total number of runs matching the same filters as {@link workflowRuns}. */
  async countWorkflowRuns(query: WorkflowRunsQueryDto = {}): Promise<{ total: number }> {
    const total = await this.prisma.client.workflowRun.count({ where: this.workflowRunWhere(query) });
    return { total };
  }

  async usage() {
    const usage = await this.usageSnapshot();
    const workspace = await this.prisma.client.workspace.findUnique({ where: { id: demoWorkspaceId } });
    return { ...usage, plan: workspace?.plan ?? "FREE" };
  }

  /** Latest scored leads: AI results that carry a `leadScore`, joined with the masked trigger input. */
  async leads(workspaceId = demoWorkspaceId): Promise<LeadSummaryView[]> {
    const results = await this.prisma.client.aiTaskResult.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { workflowRun: { select: { inputJson: true } } }
    });

    return results
      .flatMap((result): LeadSummaryView[] => {
        const output = (result.outputJson ?? {}) as Record<string, unknown>;
        if (typeof output["leadScore"] !== "number") {
          return [];
        }
        const input = maskSensitivePromptInput(result.workflowRun.inputJson ?? {}) as Record<string, unknown>;
        const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : undefined);
        return [{
          workflowRunId: result.workflowRunId,
          scoredAt: result.createdAt.toISOString(),
          name: text("name"),
          company: text("company"),
          email: text("email"),
          source: text("source"),
          leadScore: output["leadScore"] as number,
          category: String(output["category"] ?? "unknown"),
          summary: typeof output["summary"] === "string" ? output["summary"] : undefined,
          recommendedAction: typeof output["recommendedAction"] === "string" ? output["recommendedAction"] : undefined,
          confidence: typeof output["confidence"] === "number" ? output["confidence"] : undefined,
          modelName: result.modelName
        }];
      })
      .slice(0, 50);
  }

  /** Follow-up tasks created for sales by the NOTIFICATION node (type SALES_TASK). */
  async salesTasks(workspaceId = demoWorkspaceId): Promise<DashboardSalesTaskView[]> {
    const tasks = await this.prisma.client.notification.findMany({
      where: { workspaceId, type: "SALES_TASK" },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return tasks
      .map((task) => this.toSalesTask(task as NotificationRow))
      .sort((left, right) => {
        // Open work first, then the most recent task in each group.
        if (left.status !== right.status) {
          return left.status === "OPEN" ? -1 : 1;
        }
        return right.createdAt.localeCompare(left.createdAt);
      });
  }

  /** Marks a sales task as done (or re-opens it). Requires membership of the task workspace. */
  async updateSalesTask(id: string, dto: UpdateSalesTaskDto, userId: string): Promise<DashboardSalesTaskView> {
    const task = (await this.prisma.client.notification.findUnique({ where: { id } })) as NotificationRow | null;
    if (!task || task.type !== "SALES_TASK") {
      throw new NotFoundException("Sales task not found");
    }

    await this.assertWorkspaceMember(task.workspaceId, userId);

    const updated = (await this.prisma.client.notification.update({
      where: { id },
      data: { status: dto.status === "DONE" ? "DONE" : "UNREAD" }
    })) as NotificationRow;

    return this.toSalesTask(updated);
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
    // The mock provider is always available; a real model needs a non-empty OpenAI key.
    const openAiConfigured = this.hasConfiguredKey(process.env.OPENAI_API_KEY);
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
        status: openAiConfigured ? "ready" : "warning",
        summary: openAiConfigured
          ? "At least one real AI provider key is configured."
          : "Only the mock provider is configured; set OPENAI_API_KEY to use a real model.",
        action: openAiConfigured
          ? "Track AI calls and token usage by workspace before enabling quotas."
          : "Set OPENAI_API_KEY when moving beyond mock lead scoring."
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

  /** A provider key counts as configured only when it is set and not blank. */
  private hasConfiguredKey(value: string | undefined) {
    return typeof value === "string" && value.trim().length > 0;
  }

  private workflowRunWhere(query: WorkflowRunsQueryDto) {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.workflowId ? { workflowId: query.workflowId } : {})
    };
  }

  private toDashboardWorkflowRun(run: WorkflowRunRow): DashboardWorkflowRunView {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflow?.name ?? "",
      workspaceId: run.workspaceId,
      workflowVersionId: run.workflowVersionId,
      status: run.status as WorkflowRunStatus,
      triggerType: run.triggerType,
      // Lead input contains PII: clients only ever see the masked form.
      input: maskSensitivePromptInput(run.inputJson ?? {}) as Record<string, unknown>,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      errorMessage: run.errorMessage ?? undefined,
      eventId: run.triggerEventId ?? undefined
    };
  }

  private toSalesTask(task: NotificationRow, now: Date = new Date()): DashboardSalesTaskView {
    const metadata = (task.metadataJson ?? {}) as Record<string, unknown>;
    const status = task.status === "DONE" ? "DONE" : "OPEN";
    const dueAt = typeof metadata["dueAt"] === "string" ? metadata["dueAt"] : undefined;
    const dueAtMs = dueAt ? new Date(dueAt).getTime() : Number.NaN;

    return {
      id: task.id,
      title: task.title,
      body: task.body,
      status,
      dueAt,
      workflowRunId: typeof metadata["workflowRunId"] === "string" ? metadata["workflowRunId"] : undefined,
      createdAt: task.createdAt.toISOString(),
      overdue: status === "OPEN" && Number.isFinite(dueAtMs) && dueAtMs < now.getTime()
    };
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const membership = await this.prisma.client.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    const role = membership?.role as WorkspaceRole | undefined;
    if (!role || !hasRoleAtLeast(role, "MEMBER")) {
      throw new ForbiddenException("Requires role MEMBER or higher in this workspace");
    }
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
