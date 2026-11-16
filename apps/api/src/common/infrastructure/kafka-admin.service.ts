import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseKafkaBrokers } from "@agentops/config";
import { Admin, Kafka, logLevel } from "kafkajs";

@Injectable()
export class KafkaAdminService implements OnModuleDestroy {
  private admin: Admin | undefined;
  private connected = false;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async ping() {
    const admin = await this.getConnectedAdmin();

    await admin.fetchTopicMetadata();
  }

  async consumerLag(groupId: string, topic: string) {
    const admin = await this.getConnectedAdmin();
    const topicOffsets = (await admin.fetchTopicOffsets(topic)) as Array<{
      partition: number;
      offset?: string;
      high?: string;
    }>;
    const groupOffsetTopics = (await admin.fetchOffsets({ groupId, topics: [topic] })) as Array<{
      topic: string;
      partitions: Array<{ partition: number; offset?: string }>;
    }>;
    const groupOffsets = groupOffsetTopics.find((candidate) => candidate.topic === topic)?.partitions ?? [];

    return topicOffsets.map((topicOffset) => {
      const groupOffset = groupOffsets.find((candidate) => candidate.partition === topicOffset.partition);
      const latestOffset = Number(topicOffset.high ?? topicOffset.offset ?? 0);
      const committedOffset = Number(groupOffset?.offset === "-1" ? 0 : groupOffset?.offset ?? 0);

      return {
        groupId,
        topic,
        partition: topicOffset.partition,
        latestOffset,
        committedOffset,
        lag: Math.max(latestOffset - committedOffset, 0)
      };
    });
  }

  /** Messages ever written to a topic (sum of high watermarks); used for the dead-letter count. */
  async topicMessageCount(topic: string) {
    const admin = await this.getConnectedAdmin();
    const offsets = (await admin.fetchTopicOffsets(topic)) as Array<{ high?: string; offset?: string; low?: string }>;
    return offsets.reduce((sum, partition) => sum + Number(partition.high ?? partition.offset ?? 0) - Number(partition.low ?? 0), 0);
  }

  async onModuleDestroy() {
    if (!this.admin || !this.connected) {
      return;
    }

    await this.admin.disconnect();
    this.connected = false;
  }

  private getAdmin() {
    if (!this.admin) {
      const kafka = new Kafka({
        brokers: parseKafkaBrokers(this.config.get<string>("KAFKA_BROKERS") ?? "localhost:9094"),
        clientId: "agentops-api-health",
        connectionTimeout: 2_000,
        logLevel: logLevel.ERROR,
        requestTimeout: 3_000
      });
      this.admin = kafka.admin();
    }

    return this.admin;
  }

  private async getConnectedAdmin() {
    const admin = this.getAdmin();

    if (!this.connected) {
      await admin.connect();
      this.connected = true;
    }

    return admin;
  }
}
