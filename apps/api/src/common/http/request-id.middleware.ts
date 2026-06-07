import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestWithId = Request & {
  requestId?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction) {
    const incomingRequestId = request.header(REQUEST_ID_HEADER);
    const requestId = incomingRequestId?.trim() || randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
