import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
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
});
