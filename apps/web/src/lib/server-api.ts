import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { ApiError, isDemoFallbackEnabled, readError, serverApiUrl, type ApiResource } from "./api";

/**
 * Server-side GET. Forwards the incoming browser request's Cookie header (which carries the
 * HttpOnly session cookie) to the API, since server components cannot read browser storage.
 */
export async function apiGet<T>(path: string, schema?: z.ZodType<T>): Promise<T> {
  const cookie = (await headers()).get("cookie");
  const response = await fetch(`${serverApiUrl}${path}`, {
    cache: "no-store",
    headers: {
      ...(cookie ? { cookie } : {})
    }
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as unknown;
  return schema ? schema.parse(body) : (body as T);
}

/**
 * Server-side fetch for pages. On failure it returns `source: "error"` (pages render an error
 * state) unless NEXT_PUBLIC_DEMO_FALLBACK=true, in which case the demo `fallback` is shown.
 * A 401 means the session is gone, so the user is redirected to `/login`.
 */
export async function safeApiGet<T>(path: string, fallback: T, schema?: z.ZodType<T>): Promise<ApiResource<T>> {
  try {
    return { data: await apiGet<T>(path, schema), source: "api" };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    return {
      data: fallback,
      source: isDemoFallbackEnabled() ? "fallback" : "error",
      error: error instanceof Error ? error.message : "API request failed"
    };
  }
}
