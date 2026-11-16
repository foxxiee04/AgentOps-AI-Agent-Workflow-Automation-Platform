import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePublicApiUrl, runtimeConfigScript } from "./runtime-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolvePublicApiUrl", () => {
  it("prefers the runtime API_PUBLIC_URL over the build-time value", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://build.example.com");

    expect(resolvePublicApiUrl({ API_PUBLIC_URL: "https://runtime.example.com" })).toBe("https://runtime.example.com");
  });

  it("reads API_PUBLIC_URL from the process environment when no env is passed", () => {
    vi.stubEnv("API_PUBLIC_URL", "https://runtime.example.com");

    expect(resolvePublicApiUrl()).toBe("https://runtime.example.com");
  });

  it("ignores a blank API_PUBLIC_URL and falls back to the build-time value", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://build.example.com");

    expect(resolvePublicApiUrl({ API_PUBLIC_URL: "   " })).toBe("https://build.example.com");
  });

  it("strips a single trailing slash", () => {
    expect(resolvePublicApiUrl({ API_PUBLIC_URL: "https://api.example.com/" })).toBe("https://api.example.com");
  });

  it("falls back to the local default when nothing is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);

    expect(resolvePublicApiUrl({})).toBe("http://localhost:4000");
  });
});

describe("runtimeConfigScript", () => {
  it("assigns the config to the runtime global", () => {
    expect(runtimeConfigScript({ apiUrl: "https://api.example.com" })).toBe(
      'window.__AGENTOPS_CONFIG__={"apiUrl":"https://api.example.com"};'
    );
  });

  it("escapes script-closing sequences so the value cannot break out of the tag", () => {
    const script = runtimeConfigScript({ apiUrl: "https://api.example.com/</script><script>alert(1)</script>" });

    expect(script).not.toContain("</script");
    expect(script).toContain("\\u003c");
  });
});
