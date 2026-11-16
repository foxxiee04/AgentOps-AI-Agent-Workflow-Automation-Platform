import "reflect-metadata";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "../../modules/auth/auth.controller";
import { HealthController } from "../../modules/health/health.controller";
import { MetricsController } from "../../modules/metrics/metrics.controller";
import { NotificationsController } from "../../modules/notifications/notifications.controller";
import { WebhooksController } from "../../modules/webhooks/webhooks.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { IS_PUBLIC_KEY } from "./public.decorator";

type HarnessOptions = {
  handler: object;
  controller: object;
  authorization?: string | string[];
  cookie?: string;
};

function createHarness(options: HarnessOptions) {
  const auth = {
    authenticate: vi.fn(async (authorization?: string) => {
      if (!authorization) throw new UnauthorizedException("Missing bearer token");
      return { userId: "user_1", email: "user@agentops.local" };
    })
  };
  const guard = new JwtAuthGuard(new Reflector(), auth as never);
  const request: {
    headers: Record<string, string | string[] | undefined>;
    auth?: { userId: string; email: string };
  } = {
    headers: {
      ...(options.authorization === undefined ? {} : { authorization: options.authorization }),
      ...(options.cookie === undefined ? {} : { cookie: options.cookie })
    }
  };
  const context = {
    getHandler: () => options.handler,
    getClass: () => options.controller,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;

  return { guard, context, request, auth };
}

describe("JwtAuthGuard", () => {
  it("allows a public handler without an authorization header", async () => {
    const harness = createHarness({ handler: AuthController.prototype.login, controller: AuthController });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.auth.authenticate).not.toHaveBeenCalled();
  });

  it("allows every route of a public controller without an authorization header", async () => {
    const harness = createHarness({ handler: HealthController.prototype.live, controller: HealthController });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.auth.authenticate).not.toHaveBeenCalled();
  });

  it("rejects a protected route without an authorization header", async () => {
    const harness = createHarness({ handler: AuthController.prototype.me, controller: AuthController });

    await expect(harness.guard.canActivate(harness.context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(harness.request.auth).toBeUndefined();
  });

  it("allows a protected route with a valid token and sets request.auth", async () => {
    const harness = createHarness({
      handler: AuthController.prototype.me,
      controller: AuthController,
      authorization: "Bearer valid-token"
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.request.auth).toEqual({ userId: "user_1", email: "user@agentops.local" });
    expect(harness.auth.authenticate).toHaveBeenCalledWith("Bearer valid-token");
  });

  it("normalises a repeated authorization header to its first value", async () => {
    const harness = createHarness({
      handler: AuthController.prototype.me,
      controller: AuthController,
      authorization: ["Bearer valid-token", "Bearer other-token"]
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.auth.authenticate).toHaveBeenCalledWith("Bearer valid-token");
  });

  it("authenticates from the access cookie when there is no authorization header", async () => {
    const harness = createHarness({
      handler: AuthController.prototype.me,
      controller: AuthController,
      cookie: "agentops_access=tok"
    });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.auth.authenticate).toHaveBeenCalledWith("Bearer tok");
  });

  it("only marks the intended routes as public", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.login)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.register)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.refresh)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.logout)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.google)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.googleCallback)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MetricsController)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, WebhooksController.prototype.receive)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, NotificationsController.prototype.alertmanager)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.me)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, NotificationsController.prototype.findAll)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, NotificationsController.prototype.markAllRead)).toBeUndefined();
  });
});
