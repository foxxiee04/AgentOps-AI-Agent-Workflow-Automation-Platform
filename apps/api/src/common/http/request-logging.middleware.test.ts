import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import { RequestLoggingMiddleware } from "./request-logging.middleware";

describe("RequestLoggingMiddleware", () => {
  it("continues the request and registers a finish listener", () => {
    const middleware = new RequestLoggingMiddleware();
    const request = {
      method: "GET",
      originalUrl: "/ai/providers",
      requestId: "req_123"
    };
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = 200;
    const next = vi.fn();

    middleware.use(request as never, response as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.listenerCount("finish")).toBe(1);
  });

  it("logs method, path, status and requestId without headers or body values", () => {
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    try {
      const middleware = new RequestLoggingMiddleware();
      const request = {
        method: "POST",
        originalUrl: "/auth/login?redirect=/dashboard",
        requestId: "req_secret_123",
        traceId: "trace_secret_123",
        headers: { authorization: "Bearer super-secret-token" },
        body: { email: "user@example.com", password: "correct-horse-battery-staple" }
      };
      const response = new EventEmitter() as EventEmitter & { statusCode: number };
      response.statusCode = 401;

      middleware.use(request as never, response as never, vi.fn());
      response.emit("finish");

      expect(logSpy).toHaveBeenCalledOnce();
      const line = logSpy.mock.calls[0][0] as string;
      const logged = JSON.parse(line);

      expect(logged).toMatchObject({
        method: "POST",
        path: "/auth/login?redirect=/dashboard",
        statusCode: 401,
        requestId: "req_secret_123"
      });
      expect(line).not.toContain("super-secret-token");
      expect(line).not.toContain("correct-horse-battery-staple");
      expect(logged).not.toHaveProperty("authorization");
      expect(logged).not.toHaveProperty("headers");
      expect(logged).not.toHaveProperty("body");
      expect(logged).not.toHaveProperty("password");
    } finally {
      logSpy.mockRestore();
    }
  });
});
