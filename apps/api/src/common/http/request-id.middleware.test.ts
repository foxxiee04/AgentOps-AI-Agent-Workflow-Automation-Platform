import { describe, expect, it } from "vitest";
import { normalizeSpanPath, RequestIdMiddleware } from "./request-id.middleware";

describe("normalizeSpanPath", () => {
  it("replaces run, workflow and version ids so span names stay low-cardinality", () => {
    expect(normalizeSpanPath("/workflow-runs/run_1fb6aba7-b19a-491f-b675-47633101cbfc/steps/approval-1/approval")).toBe(
      "/workflow-runs/:runId/steps/approval-1/approval"
    );
    expect(normalizeSpanPath("/workflows/wf_lead_qualification/run")).toBe("/workflows/:workflowId/run");
    expect(normalizeSpanPath("/dashboard/leads")).toBe("/dashboard/leads");
  });
});

function runMiddleware(headers: Record<string, string>) {
  const request = {
    method: "GET",
    url: "/dashboard/leads",
    originalUrl: "/dashboard/leads",
    header: (name: string) => headers[name.toLowerCase()]
  } as never as Parameters<RequestIdMiddleware["use"]>[0];
  const responseHeaders: Record<string, string> = {};
  const response = {
    statusCode: 200,
    setHeader: (name: string, value: string) => {
      responseHeaders[name.toLowerCase()] = value;
    },
    on: () => undefined
  } as never as Parameters<RequestIdMiddleware["use"]>[1];
  let called = false;
  new RequestIdMiddleware().use(request, response, () => {
    called = true;
  });
  return { request: request as unknown as { traceId: string; traceparent: string }, responseHeaders, called };
}

describe("RequestIdMiddleware traces", () => {
  it("starts a new trace when the caller sends no traceparent", () => {
    const { request, responseHeaders, called } = runMiddleware({});
    expect(called).toBe(true);
    expect(responseHeaders.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    expect(responseHeaders.traceparent.split("-")[1]).toBe(request.traceId);
  });

  it("continues the caller's trace when a traceparent is sent", () => {
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const { request } = runMiddleware({ traceparent: `00-${traceId}-00f067aa0ba902b7-01` });
    expect(request.traceId).toBe(traceId);
  });
});
