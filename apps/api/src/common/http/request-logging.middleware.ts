import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { RequestWithId } from "./request-id.middleware";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on("finish", () => {
      if (request.originalUrl.startsWith("/health/live")) {
        return;
      }

      this.logger.log(
        JSON.stringify({
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          requestId: request.requestId
        })
      );
    });

    next();
  }
}
