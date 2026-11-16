import { describe, expect, it, vi } from "vitest";
import { MetricsController } from "./metrics.controller";

describe("MetricsController", () => {
  it("exports lag for every consumed topic, dead letters, pending approvals and the outbox backlog", async () => {
    const kafkaAdmin = {
      consumerLag: vi.fn(async (groupId: string, topic: string) => [{ groupId, topic, partition: 0, lag: topic === "agent-task-completed" ? 7 : 0 }]),
      topicMessageCount: vi.fn(async () => 3)
    };
    const prisma = {
      client: {
        humanApproval: { groupBy: vi.fn(async () => [{ workspaceId: "ws_demo", _count: { _all: 2 } }]) },
        domainEvent: { count: vi.fn(async () => 1) },
        user: { count: vi.fn(async () => 5) },
        authRefreshToken: { findMany: vi.fn(async () => [{ userId: "user_1" }, { userId: "user_2" }]) }
      }
    };

    const text = await new MetricsController(kafkaAdmin as never, prisma as never).metrics();

    expect(text).toContain('agentops_kafka_consumer_lag{group_id="agentops.workflow-worker",topic="agent-task-completed",partition="0"} 7');
    expect(text).toContain('agentops_kafka_consumer_lag{group_id="agentops.ai-worker",topic="agent-task-requested",partition="0"} 0');
    expect(text).toContain('agentops_kafka_topic_messages{topic="dead-letter-events"} 3');
    expect(text).toContain('agentops_approvals_pending{workspace_id="ws_demo"} 2');
    expect(text).toContain("agentops_domain_events_unpublished 1");
    expect(text).toContain("agentops_users_total 5");
    expect(text).toContain('agentops_active_users{window="24h"} 2');
    expect(text).toMatch(/agentops_auth_logins_total\{provider="google",result="failure"\} \d+/);
  });

  it("still renders metrics when Kafka is unreachable", async () => {
    const kafkaAdmin = {
      consumerLag: vi.fn(async () => {
        throw new Error("broker down");
      }),
      topicMessageCount: vi.fn(async () => {
        throw new Error("broker down");
      })
    };
    const prisma = {
      client: {
        humanApproval: { groupBy: vi.fn(async () => []) },
        domainEvent: { count: vi.fn(async () => 0) },
        user: { count: vi.fn(async () => 0) },
        authRefreshToken: { findMany: vi.fn(async () => []) }
      }
    };

    await expect(new MetricsController(kafkaAdmin as never, prisma as never).metrics()).resolves.toContain("agentops_api_process_uptime_seconds");
  });
});
