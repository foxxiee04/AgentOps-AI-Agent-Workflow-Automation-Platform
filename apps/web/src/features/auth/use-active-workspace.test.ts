import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthWorkspace } from "./auth-client";
import {
  getWorkspaceCookie,
  resolveActiveWorkspace,
  setActiveWorkspace,
  setWorkspaceCookie,
  WORKSPACE_COOKIE_NAME
} from "./use-active-workspace";

const sampleWorkspaces: AuthWorkspace[] = [
  { id: "ws_1", name: "Workspace One", slug: "ws-1", role: "OWNER" },
  { id: "ws_2", name: "Workspace Two", slug: "ws-2", role: "MEMBER" }
];

describe("resolveActiveWorkspace", () => {
  it("resolves to matching workspace when cookie is valid", () => {
    const active = resolveActiveWorkspace(sampleWorkspaces, "ws_2");
    expect(active).toEqual(sampleWorkspaces[1]);
  });

  it("resolves to first workspace when cookie is unknown", () => {
    const active = resolveActiveWorkspace(sampleWorkspaces, "ws_unknown");
    expect(active).toEqual(sampleWorkspaces[0]);
  });

  it("resolves to first workspace when cookie is not provided", () => {
    expect(resolveActiveWorkspace(sampleWorkspaces, undefined)).toEqual(sampleWorkspaces[0]);
    expect(resolveActiveWorkspace(sampleWorkspaces, null)).toEqual(sampleWorkspaces[0]);
    expect(resolveActiveWorkspace(sampleWorkspaces, "")).toEqual(sampleWorkspaces[0]);
  });

  it("resolves to undefined when user has no workspaces", () => {
    expect(resolveActiveWorkspace([], "ws_1")).toBeUndefined();
    expect(resolveActiveWorkspace(undefined, "ws_1")).toBeUndefined();
  });
});

describe("cookie helpers and setActiveWorkspace", () => {
  let cookieJar: string;

  beforeEach(() => {
    cookieJar = "";
    const documentStub = {
      get cookie() {
        return cookieJar;
      },
      set cookie(val: string) {
        const parts = val.split(";")[0]?.trim();
        if (!parts) return;
        const [name, ...rest] = parts.split("=");
        const value = rest.join("=");
        const existing = cookieJar
          .split(";")
          .map((c) => c.trim())
          .filter((c) => c && !c.startsWith(`${name}=`));
        if (val.includes("Max-Age=0")) {
          cookieJar = existing.join("; ");
        } else {
          cookieJar = [...existing, `${name}=${value}`].join("; ");
        }
      }
    };

    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads and writes the workspace cookie", () => {
    expect(getWorkspaceCookie()).toBeUndefined();
    setWorkspaceCookie("ws_2");
    expect(getWorkspaceCookie()).toBe("ws_2");
  });

  it("setActiveWorkspace writes cookie, dispatches event, and calls router.refresh()", () => {
    const mockRouter = { refresh: vi.fn() };
    setActiveWorkspace("ws_2", mockRouter);

    expect(getWorkspaceCookie()).toBe("ws_2");
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(Event));
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  });
});
