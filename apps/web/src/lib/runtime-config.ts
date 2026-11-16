/**
 * Runtime configuration for the browser-facing API URL.
 *
 * `NEXT_PUBLIC_API_URL` is inlined by Next.js at build time, so an image built for one environment
 * keeps calling that environment's API forever. `API_PUBLIC_URL` is read on the server per request
 * and injected into the HTML, so the same image can be promoted to another environment.
 */

export const RUNTIME_CONFIG_GLOBAL = "__AGENTOPS_CONFIG__";

export type RuntimeConfig = {
  apiUrl: string;
};

declare global {
  interface Window {
    __AGENTOPS_CONFIG__?: RuntimeConfig;
  }
}

const DEFAULT_PUBLIC_API_URL = "http://localhost:4000";

/** Trims the value and drops a single trailing slash so URLs can be concatenated safely. */
function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, "");
}

/**
 * Server-side resolution of the public API URL: the runtime `API_PUBLIC_URL` wins, the build-time
 * `NEXT_PUBLIC_API_URL` is the fallback and `http://localhost:4000` the last resort.
 */
export function resolvePublicApiUrl(env: Record<string, string | undefined> = process.env): string {
  const runtime = env.API_PUBLIC_URL?.trim();
  // `process.env.NEXT_PUBLIC_API_URL` has to stay a literal member access: Next.js only inlines it then.
  const buildTime = process.env.NEXT_PUBLIC_API_URL?.trim();
  return normalizeUrl(runtime || buildTime || DEFAULT_PUBLIC_API_URL);
}

/** Serializes the runtime config into an inline script; `<` is escaped so the value cannot close the script tag. */
export function runtimeConfigScript(config: RuntimeConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.${RUNTIME_CONFIG_GLOBAL}=${json};`;
}

/**
 * Browser-side API URL: the value injected by the root layout, falling back to the build-time
 * value when the script did not run (for example in a test or a prerendered page).
 */
export function readPublicApiUrl(): string {
  if (typeof window !== "undefined") {
    const injected = window[RUNTIME_CONFIG_GLOBAL]?.apiUrl;
    if (typeof injected === "string" && injected.trim().length > 0) {
      return normalizeUrl(injected);
    }
  }
  return resolvePublicApiUrl();
}
