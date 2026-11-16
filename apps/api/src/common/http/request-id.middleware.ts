import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import {
  createTraceId,
  createTraceparent,
  parseTraceparent,
  recordSpanException,
  runWithOtelContext,
  SpanKind,
  SpanStatusCode,
  startOtelSpan
} from "@agentops/observability";
import type { NextFunction, Request, Response } from "express";
import { runWithRequestContext } from "./request-context";

export const REQUEST_ID_HEADER = "x-request-id";
export const TRACEPARENT_HEADER = "traceparent";

export type RequestWithId = Request & {
  requestId?: string;
  traceId?: string;
  traceparent?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction) {
    const incomingRequestId = request.header(REQUEST_ID_HEADER);
    const requestId = incomingRequestId?.trim() || randomUUID();
    const incomingTrace = parseTraceparent(request.header(TRACEPARENT_HEADER));
    const traceId = incomingTrace?.traceId ?? createTraceId();
    const parentTraceparent = incomingTrace?.traceparent ?? createTraceparent(traceId);
    // Inside middleware mounted with forRoutes("*"), request.path is relative ("/"); use the original URL.
    const path = (request.originalUrl ?? request.url).split("?")[0] || "/";
    const activeSpan = startOtelSpan(`HTTP ${request.method} ${normalizeSpanPath(path)}`, {
      kind: SpanKind.SERVER,
      traceparent: parentTraceparent,
      attributes: {
        "agentops.request_id": requestId,
        "http.request.method": request.method,
        "url.path": path,
        "url.query": request.url.includes("?") ? request.url.split("?").slice(1).join("?") : undefined
      }
    });
    const activeTraceparent = activeSpan.traceparent ?? parentTraceparent;

    request.requestId = requestId;
    request.traceId = activeSpan.traceId;
    request.traceparent = activeTraceparent;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.setHeader(TRACEPARENT_HEADER, activeTraceparent);
    response.on("finish", () => {
      activeSpan.span.setAttribute("http.response.status_code", response.statusCode);
      if (response.statusCode >= 500) {
        activeSpan.span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.statusCode}` });
      }
      activeSpan.span.end();
    });
    runWithOtelContext(activeSpan.context, () =>
      runWithRequestContext({ requestId, traceId: activeSpan.traceId, traceparent: activeTraceparent }, () => {
        try {
          next();
        } catch (error) {
          recordSpanException(activeSpan.span, error);
          activeSpan.span.end();
          throw error;
        }
      })
    );
  }
}

/** Keeps span names low-cardinality: ids become placeholders. */
export function normalizeSpanPath(path: string) {
  return path
    .replace(/\/run_[^/]+/g, "/:runId")
    .replace(/\/wfv_[^/]+/g, "/:workflowVersionId")
    .replace(/\/wf_[^/]+/g, "/:workflowId")
    .replace(/\/(?:[0-9a-f]{8}-[0-9a-f-]{27,}|c[a-z0-9]{24})(?=\/|$)/gi, "/:id");
}
