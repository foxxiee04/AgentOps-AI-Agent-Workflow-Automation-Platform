import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { RequestWithId } from "./request-id.middleware";
import { recordHttpRequest } from "../metrics/api-metrics";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on("finish", () => {
      if (request.originalUrl.startsWith("/health/live")) {
        return;
      }

      recordHttpRequest(request.method, request.originalUrl, response.statusCode, Date.now() - startedAt);

      this.logger.log(
        JSON.stringify({
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          requestId: request.requestId,
          traceId: request.traceId
        })
      );
    });

    next();
  }
}
