import "reflect-metadata";
import { APP_GUARD } from "@nestjs/core";
import {
  THROTTLER_LIMIT,
  THROTTLER_SKIP,
  THROTTLER_TTL
} from "@nestjs/throttler/dist/throttler.constants";
import { ThrottlerGuard } from "@nestjs/throttler";
import { describe, expect, it } from "vitest";
import { AppModule } from "../../app.module";
import { AuthController } from "../../modules/auth/auth.controller";
import { HealthController } from "../../modules/health/health.controller";
import { MetricsController } from "../../modules/metrics/metrics.controller";

const DEFAULT = "default";

describe("rate limiting", () => {
  it("registers ThrottlerGuard as a global APP_GUARD", () => {
    const providers: Array<{ provide: unknown; useClass?: unknown }> = Reflect.getMetadata("providers", AppModule) ?? [];

    expect(providers).toContainEqual({ provide: APP_GUARD, useClass: ThrottlerGuard });
  });

  it.each(["login", "register", "refresh"] as const)("overrides the default throttle for auth %s", (method) => {
    const handler = AuthController.prototype[method];
    const limit = Reflect.getMetadata(`${THROTTLER_LIMIT}${DEFAULT}`, handler);
    const ttl = Reflect.getMetadata(`${THROTTLER_TTL}${DEFAULT}`, handler);

    expect(limit).toBeGreaterThan(0);
    expect(ttl).toBe(60_000);
  });

  it("skips throttling for health probes", () => {
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}${DEFAULT}`, HealthController)).toBe(true);
  });

  it("skips throttling for the Prometheus metrics endpoint", () => {
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}${DEFAULT}`, MetricsController)).toBe(true);
  });
});
