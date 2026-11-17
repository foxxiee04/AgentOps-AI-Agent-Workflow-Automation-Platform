import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthWorkspace } from "../features/auth/auth-client";

let mockCookieValue: string | undefined = undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "agentops_ws" && mockCookieValue ? { value: mockCookieValue } : undefined)
  }),
  headers: async () => new Headers({ cookie: "agentops_session=1" })
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }
}));

import { getActiveWorkspace, resolveActiveWorkspace } from "./workspace";

afterEach(() => {
  mockCookieValue = undefined;
  vi.unstubAllGlobals();
});

const sampleWorkspaces: AuthWorkspace[] = [
  { id: "ws_alpha", name: "Alpha Team", slug: "alpha-team", role: "OWNER" },
  { id: "ws_beta", name: "Beta Projects", slug: "beta-projects", role: "MEMBER" },
  { id: "ws_gamma", name: "Gamma Labs", slug: "gamma-labs", role: "VIEWER" }
];

describe("workspace resolution order", () => {
  it("resolves to the cookie workspace when the cookie is valid and belongs to the user", () => {
    const result = resolveActiveWorkspace(sampleWorkspaces, "ws_beta");
    expect(result).toBeDefined();
    expect(result?.id).toBe("ws_beta");
    expect(result?.name).toBe("Beta Projects");
  });

  it("resolves to the user's first workspace when the cookie is unknown", () => {
    const result = resolveActiveWorkspace(sampleWorkspaces, "ws_nonexistent");
    expect(result).toBeDefined();
    expect(result?.id).toBe("ws_alpha");
    expect(result?.name).toBe("Alpha Team");
  });

  it("resolves to the user's first workspace when cookie is missing or empty", () => {
    expect(resolveActiveWorkspace(sampleWorkspaces, undefined)?.id).toBe("ws_alpha");
    expect(resolveActiveWorkspace(sampleWorkspaces, null)?.id).toBe("ws_alpha");
    expect(resolveActiveWorkspace(sampleWorkspaces, "")?.id).toBe("ws_alpha");
  });

  it("resolves to undefined when the user has no workspaces", () => {
    expect(resolveActiveWorkspace([], "ws_alpha")).toBeUndefined();
    expect(resolveActiveWorkspace([], undefined)).toBeUndefined();
    expect(resolveActiveWorkspace(undefined, "ws_alpha")).toBeUndefined();
    expect(resolveActiveWorkspace(undefined, undefined)).toBeUndefined();
  });
});

describe("getActiveWorkspace (server-side)", () => {
  it("returns workspaces and the active workspace matching the cookie", async () => {
    mockCookieValue = "ws_beta";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "u_1",
          email: "user@example.com",
          name: "User",
          workspaces: sampleWorkspaces
        })
      )
    );

    const { workspaces, active } = await getActiveWorkspace();
    expect(workspaces).toHaveLength(3);
    expect(active?.id).toBe("ws_beta");
  });

  it("falls back to the first workspace when the cookie is unknown", async () => {
    mockCookieValue = "ws_unknown";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "u_1",
          email: "user@example.com",
          name: "User",
          workspaces: sampleWorkspaces
        })
      )
    );

    const { workspaces, active } = await getActiveWorkspace();
    expect(workspaces).toHaveLength(3);
    expect(active?.id).toBe("ws_alpha");
  });

  it("returns empty workspaces and undefined active when the user has no workspaces", async () => {
    mockCookieValue = "ws_alpha";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "u_1",
          email: "user@example.com",
          name: "User",
          workspaces: []
        })
      )
    );

    const { workspaces, active } = await getActiveWorkspace();
    expect(workspaces).toEqual([]);
    expect(active).toBeUndefined();
  });

  it("redirects to /login when /auth/me returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Unauthorized" }, { status: 401 })
      )
    );

    await expect(getActiveWorkspace()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
