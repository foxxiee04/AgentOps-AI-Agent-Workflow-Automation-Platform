import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ cookie: "agentops_access=abc" })
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }
}));

import { ApiError, approvalErrorKey, clientApiGet, decideApproval, isDemoFallbackEnabled, safeHealthGet, runSchemas } from "./api";
import { safeApiGet } from "./server-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("demo fallback flag", () => {
  it("is off unless NEXT_PUBLIC_DEMO_FALLBACK is exactly 'true'", () => {
    expect(isDemoFallbackEnabled({})).toBe(false);
    expect(isDemoFallbackEnabled({ NEXT_PUBLIC_DEMO_FALLBACK: "1" })).toBe(false);
    expect(isDemoFallbackEnabled({ NEXT_PUBLIC_DEMO_FALLBACK: "true" })).toBe(true);
  });

  it("reports an error state instead of demo data when the API is down and the flag is off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));

    const resource = await safeApiGet("/dashboard/overview", { demo: true });

    expect(resource.source).toBe("error");
    expect(resource.error).toContain("down");
  });

  it("shows the demo fallback only when the flag is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_FALLBACK", "true");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));

    const resource = await safeApiGet("/dashboard/overview", { demo: true });

    expect(resource).toMatchObject({ source: "fallback", data: { demo: true } });
  });

  it("redirects to /login when the API rejects the request with 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Missing bearer token" }, { status: 401 })));

    const error = await safeApiGet("/dashboard/overview", { demo: true }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("NEXT_REDIRECT:/login");
  });
});

describe("safeHealthGet", () => {
  it("keeps the readiness report as API data when a dependency makes it return 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            status: "error",
            info: { postgres: { status: "up" }, kafka: { status: "up" } },
            error: { redis: { status: "down" } },
            details: {
              postgres: { status: "up" },
              redis: { status: "down", message: "connection refused" },
              kafka: { status: "up" }
            }
          },
          { status: 503 }
        )
      )
    );

    const resource = await safeHealthGet("/health/ready", { status: "offline" });

    expect(resource.source).toBe("api");
    expect(resource.data).toMatchObject({
      status: "error",
      details: { postgres: { status: "up" }, redis: { status: "down" }, kafka: { status: "up" } }
    });
  });

  it("reads the readiness report wrapped by the API exception filter (real 503 shape)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            statusCode: 503,
            error: { redis: { status: "down", message: "Connection is closed." } },
            message: "Service Unavailable Exception",
            details: { postgres: { status: "up" }, kafka: { status: "up" }, redis: { status: "down" } },
            requestId: "req_1"
          },
          { status: 503 }
        )
      )
    );

    const resource = await safeHealthGet("/health/ready", { status: "offline" });

    expect(resource.source).toBe("api");
    expect(resource.data).toMatchObject({ status: "error", details: { postgres: { status: "up" }, redis: { status: "down" } } });
  });

  it("falls back to the error state when 503 has no readiness body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));

    const resource = await safeHealthGet("/health/ready", { status: "offline" });

    expect(resource.source).toBe("error");
    expect(resource.data).toEqual({ status: "offline" });
  });
});

describe("session cookies", () => {
  it("forwards the incoming Cookie header to the API without a bearer header", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await safeApiGet("/dashboard/overview", { demo: true });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const requestHeaders = new Headers(init.headers);
    expect(requestHeaders.get("cookie")).toBe("agentops_access=abc");
    expect(requestHeaders.get("authorization")).toBeNull();
  });

  it("sends credentialed requests from the browser without a bearer header", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        eventId: "evt_1",
        approval: {
          id: "apr_1",
          workspaceId: "ws_demo",
          workflowRunId: "run_1",
          nodeId: "approval-1",
          stepId: "run_1_approval-1",
          status: "APPROVED",
          review: { email: { subject: "Hi" } },
          requestedAt: "2026-10-18T00:00:00.000Z"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await decideApproval({ workflowRunId: "run_1", stepId: "run_1_approval-1" }, { decision: "approve" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("refreshes once on 401 and retries the original request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: "unauthorized" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ user: { id: "u_1", email: "a@b.c", name: "A" } }))
      .mockResolvedValueOnce(Response.json({ workflowRunId: "run_1", steps: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await clientApiGet("/workflow-runs/run_1/steps", runSchemas.steps);

    expect(result).toEqual({ workflowRunId: "run_1", steps: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/auth\/refresh$/);
    const [, retryInit] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(retryInit.credentials).toBe("include");
  });

  it("surfaces the original 401 as ApiError when the refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: "unauthorized" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ message: "invalid refresh" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await clientApiGet("/workflow-runs/run_1/steps").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("approval decisions", () => {
  it("posts the decision to the step approval endpoint and validates the response", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        eventId: "evt_1",
        approval: {
          id: "apr_1",
          workspaceId: "ws_demo",
          workflowRunId: "run_1",
          nodeId: "approval-1",
          stepId: "run_1_approval-1",
          status: "APPROVED",
          review: { email: { subject: "Hi" } },
          requestedAt: "2026-10-18T00:00:00.000Z"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await decideApproval({ workflowRunId: "run_1", stepId: "run_1_approval-1" }, { decision: "approve", comment: "ok" });

    expect(result.approval.status).toBe("APPROVED");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/workflow-runs\/run_1\/steps\/run_1_approval-1\/approval$/);
    expect(JSON.parse(String(init.body))).toEqual({ decision: "approve", comment: "ok" });
  });

  it("turns API errors into ApiError with status and details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "This step was already approved", details: { status: "APPROVED" } }, { status: 409 }))
    );

    const error = await decideApproval({ workflowRunId: "run_1", stepId: "approval-1" }, { decision: "reject" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "This step was already approved", details: { status: "APPROVED" } });
  });

  it.each([
    [409, "conflict"],
    [403, "forbidden"],
    [401, "unauthorized"],
    [500, "failed"]
  ] as const)("maps HTTP %i to the '%s' message", (status, key) => {
    expect(approvalErrorKey(new ApiError(status, "x"))).toBe(key);
  });
});
