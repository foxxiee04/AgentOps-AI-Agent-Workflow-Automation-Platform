import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseKafkaBrokers } from "@agentops/config";
import { Admin, Kafka, logLevel } from "kafkajs";

@Injectable()
export class KafkaAdminService implements OnModuleDestroy {
  private admin: Admin | undefined;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async ping() {
    const admin = this.getAdmin();

    if (!this.connected) {
      await admin.connect();
      this.connected = true;
    }

    await admin.fetchTopicMetadata();
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
}
