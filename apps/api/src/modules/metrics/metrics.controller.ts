import { Controller, Get, Header, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { consumerGroups, kafkaTopics } from "@agentops/events";
import { KafkaAdminService } from "../../common/infrastructure/kafka-admin.service";
import { metricsRegistry, recordKafkaConsumerLag } from "../../common/metrics/api-metrics";

@ApiTags("metrics")
@Controller("metrics")
export class MetricsController {
  constructor(@Inject(KafkaAdminService) private readonly kafkaAdmin: KafkaAdminService) {}

  @Get()
  @Header("Content-Type", metricsRegistry.contentType)
  async metrics(): Promise<string> {
    await this.refreshKafkaLagMetrics();
    return metricsRegistry.metrics();
  }

  private async refreshKafkaLagMetrics() {
    const lagTargets = [
      { groupId: consumerGroups.workflowWorker, topic: kafkaTopics.workflowTriggered },
      { groupId: consumerGroups.aiWorker, topic: kafkaTopics.agentTaskRequested },
      { groupId: consumerGroups.toolWorker, topic: kafkaTopics.toolCallRequested },
      { groupId: consumerGroups.notificationWorker, topic: kafkaTopics.notificationRequested }
    ];

    const lagSamples = await Promise.allSettled(
      lagTargets.map((target) => this.kafkaAdmin.consumerLag(target.groupId, target.topic))
    );
    recordKafkaConsumerLag(lagSamples.flatMap((sample) => (sample.status === "fulfilled" ? sample.value : [])));
  }
}
