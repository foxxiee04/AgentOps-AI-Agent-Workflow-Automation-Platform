import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hasRoleAtLeast, type WorkspaceRole } from "@agentops/shared";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { WorkflowsService } from "../workflows/workflows.service";

const SECRET_PREFIX = "whsec_";

type WebhookEndpointRecord = {
  id: string;
  workspaceId: string;
  workflowId: string;
  secretHash: string;
  isActive: boolean;
  createdAt: Date;
};

export type WebhookEndpointView = {
  id: string;
  workflowId: string;
  workspaceId: string;
  isActive: boolean;
  createdAt: string;
  url: string;
};

export type CreatedWebhookEndpointView = WebhookEndpointView & { secret: string };

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  /** Creates an endpoint for the workflow's workspace and reveals the signing secret exactly once. */
  async create(workflowId: string, userId: string): Promise<CreatedWebhookEndpointView> {
    const workflow = await this.prisma.client.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, workspaceId: true }
    });
    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }

    await this.assertRole(userId, workflow.workspaceId, "ADMIN");

    const secret = `${SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
    const endpoint = await this.prisma.client.webhookEndpoint.create({
      data: {
        workspaceId: workflow.workspaceId,
        workflowId: workflow.id,
        secretHash: this.hashSecret(secret)
      }
    });

    return { ...this.toView(endpoint), secret };
  }

  async list(workspaceId: string): Promise<WebhookEndpointView[]> {
    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });

    return endpoints.map((endpoint) => this.toView(endpoint));
  }

  /** Soft delete: the endpoint row and the audit trail are kept, but inbound calls stop working. */
  async deactivate(id: string, userId: string): Promise<WebhookEndpointView> {
    const endpoint = await this.prisma.client.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) {
      throw new NotFoundException("Webhook endpoint not found");
    }

    await this.assertRole(userId, endpoint.workspaceId, "ADMIN");

    const updated = await this.prisma.client.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { isActive: false }
    });

    return this.toView(updated);
  }

  /**
   * Public receive path: external callers authenticate with the endpoint secret, not with a JWT.
   * Unknown or disabled endpoints are indistinguishable (404) so ids cannot be probed.
   */
  async receive(id: string, secret: string | undefined, payload: unknown) {
    const endpoint = await this.prisma.client.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint || !endpoint.isActive) {
      throw new NotFoundException("Webhook endpoint not found");
    }

    if (!secret || !this.secretMatches(secret, endpoint.secretHash)) {
      throw new UnauthorizedException("Invalid webhook secret");
    }

    const input = this.requireObjectBody(payload);
    const { run } = await this.workflows.run(endpoint.workflowId, { input, triggerType: "webhook" });

    await this.prisma.client.auditLog.create({
      data: {
        workspaceId: endpoint.workspaceId,
        action: "webhook.received",
        entityType: "WebhookEndpoint",
        entityId: endpoint.id,
        metadataJson: { workflowId: endpoint.workflowId, runId: run.id }
      }
    });

    return { runId: run.id, status: run.status };
  }

  private async assertRole(userId: string, workspaceId: string, required: WorkspaceRole) {
    const membership = await this.prisma.client.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    const role = membership?.role as WorkspaceRole | undefined;
    if (!role || !hasRoleAtLeast(role, required)) {
      throw new ForbiddenException(`Requires role ${required} or higher in this workspace`);
    }
  }

  private requireObjectBody(payload: unknown): Record<string, unknown> {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new BadRequestException("Webhook body must be a JSON object");
    }

    return payload as Record<string, unknown>;
  }

  private secretMatches(secret: string, secretHash: string) {
    const provided = Buffer.from(this.hashSecret(secret));
    const expected = Buffer.from(secretHash);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }

  /** Mirrors the refresh-token hashing in AuthService: salted SHA-256 stored as hex. */
  private hashSecret(secret: string) {
    return createHash("sha256").update(`${this.hashKey()}:${secret}`).digest("hex");
  }

  private hashKey() {
    return this.config.get<string>("JWT_REFRESH_SECRET") ?? process.env.JWT_REFRESH_SECRET ?? "replace-me-refresh";
  }

  private toView(endpoint: WebhookEndpointRecord): WebhookEndpointView {
    return {
      id: endpoint.id,
      workflowId: endpoint.workflowId,
      workspaceId: endpoint.workspaceId,
      isActive: endpoint.isActive,
      createdAt: endpoint.createdAt.toISOString(),
      url: this.urlFor(endpoint.id)
    };
  }

  private urlFor(id: string) {
    // API_PUBLIC_URL is what external callers can reach; API_URL is the in-cluster address in Kubernetes.
    const configured =
      this.config.get<string>("API_PUBLIC_URL") ?? process.env.API_PUBLIC_URL ?? this.config.get<string>("API_URL") ?? process.env.API_URL;
    const baseUrl = (configured ?? "http://localhost:4000").replace(/\/+$/, "");
    return `${baseUrl}/webhooks/${id}`;
  }
}
