import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAuthUser } from "./auth-client";

function stubBrowser(cookie: string) {
  let jar = cookie;
  const documentStub = {
    get cookie() {
      return jar;
    },
    set cookie(value: string) {
      const name = value.split("=")[0]?.trim();
      if (name === "agentops_access_token") {
        jar = jar
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part && part.split("=")[0] !== name)
          .join("; ");
      }
    }
  };

  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("window", {
    localStorage: { removeItem: vi.fn(), getItem: vi.fn(), setItem: vi.fn() },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadAuthUser", () => {
  it("makes no request when the session hint cookie is absent", async () => {
    stubBrowser("theme=dark");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadAuthUser(true)).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls /auth/me when the session hint cookie is present", async () => {
    stubBrowser("theme=dark; agentops_session=1");
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "user_1", email: "ada@example.com", name: "Ada" })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadAuthUser(true)).resolves.toMatchObject({ id: "user_1", email: "ada@example.com" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/me"), expect.objectContaining({ credentials: "include" }));
  });
});
