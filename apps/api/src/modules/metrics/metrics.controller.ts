import { Controller, Get, Header, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { consumerGroups, kafkaTopics } from "@agentops/events";
import { Public } from "../../common/auth/public.decorator";
import { KafkaAdminService } from "../../common/infrastructure/kafka-admin.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import {
  activeUsers,
  approvalsPending,
  domainEventsUnpublished,
  kafkaTopicMessages,
  metricsRegistry,
  recordKafkaConsumerLag,
  usersTotal
} from "../../common/metrics/api-metrics";

/** Every (consumer group, topic) pair a worker consumes; lag is exported for each. */
export const lagTargets = [
  ...[
    kafkaTopics.workflowTriggered,
    kafkaTopics.agentTaskCompleted,
    kafkaTopics.toolCallCompleted,
    kafkaTopics.humanApprovalDecided,
    kafkaTopics.workflowStepFailed
  ].map((topic) => ({ groupId: consumerGroups.workflowWorker, topic })),
  { groupId: consumerGroups.aiWorker, topic: kafkaTopics.agentTaskRequested },
  { groupId: consumerGroups.toolWorker, topic: kafkaTopics.toolCallRequested },
  { groupId: consumerGroups.notificationWorker, topic: kafkaTopics.notificationRequested }
];

@ApiTags("metrics")
@Controller("metrics")
@Public()
@SkipThrottle()
export class MetricsController {
  constructor(
    @Inject(KafkaAdminService) private readonly kafkaAdmin: KafkaAdminService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Get()
  @Header("Content-Type", metricsRegistry.contentType)
  async metrics(): Promise<string> {
    await Promise.allSettled([this.refreshKafkaMetrics(), this.refreshDatabaseGauges()]);
    return metricsRegistry.metrics();
  }

  private async refreshKafkaMetrics() {
    const lagSamples = await Promise.allSettled(lagTargets.map((target) => this.kafkaAdmin.consumerLag(target.groupId, target.topic)));
    recordKafkaConsumerLag(lagSamples.flatMap((sample) => (sample.status === "fulfilled" ? sample.value : [])));
    kafkaTopicMessages.set({ topic: kafkaTopics.deadLetterEvents }, await this.kafkaAdmin.topicMessageCount(kafkaTopics.deadLetterEvents));
  }

  private async refreshDatabaseGauges() {
    const now = Date.now();
    const activeWindows = [
      { window: "24h", since: new Date(now - 24 * 60 * 60_000) },
      { window: "7d", since: new Date(now - 7 * 24 * 60 * 60_000) }
    ];
    const [pending, unpublished, users, activeCounts] = await Promise.all([
      this.prisma.client.humanApproval.groupBy({ by: ["workspaceId"], where: { status: "WAITING_APPROVAL" }, _count: { _all: true } }),
      this.prisma.client.domainEvent.count({ where: { kafkaPublishedAt: null } }),
      this.prisma.client.user.count(),
      Promise.all(
        activeWindows.map((active) =>
          this.prisma.client.authRefreshToken.findMany({
            where: { createdAt: { gte: active.since } },
            distinct: ["userId"],
            select: { userId: true }
          })
        )
      )
    ]);
    for (const row of pending) {
      approvalsPending.set({ workspace_id: row.workspaceId }, row._count._all);
    }
    if (pending.length === 0) {
      approvalsPending.set({ workspace_id: "ws_demo" }, 0);
    }
    domainEventsUnpublished.set({}, unpublished);
    usersTotal.set({}, users);
    activeWindows.forEach((active, index) => activeUsers.set({ window: active.window }, activeCounts[index].length));
  }
}
