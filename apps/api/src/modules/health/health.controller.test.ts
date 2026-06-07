import { describe, expect, it, vi } from "vitest";
import { HealthCheckError, HealthCheckService, HealthIndicatorFunction } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

function createHealthService(): HealthCheckService {
  return {
    check: async (indicators: HealthIndicatorFunction[]) => {
      const checks = await Promise.all(indicators.map((indicator) => indicator()));
      const info = Object.assign({}, ...checks);

      return {
        status: "ok",
        info,
        error: {},
        details: info
      };
    }
  } as HealthCheckService;
}

describe("HealthController", () => {
  it("reports all infrastructure dependencies as ready", async () => {
    const controller = new HealthController(
      createHealthService(),
      { ping: vi.fn().mockResolvedValue(undefined) },
      { ping: vi.fn().mockResolvedValue(undefined) },
      { ping: vi.fn().mockResolvedValue(undefined) }
    );

    await expect(controller.ready()).resolves.toMatchObject({
      status: "ok",
      info: {
        postgres: { status: "up" },
        redis: { status: "up" },
        kafka: { status: "up" }
      }
    });
  });

  it("marks readiness as failed when a dependency ping fails", async () => {
    const controller = new HealthController(
      createHealthService(),
      { ping: vi.fn().mockRejectedValue(new Error("database offline")) },
      { ping: vi.fn().mockResolvedValue(undefined) },
      { ping: vi.fn().mockResolvedValue(undefined) }
    );

    await expect(controller.ready()).rejects.toBeInstanceOf(HealthCheckError);
  });
});
