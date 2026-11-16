import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { hasAuthCookie } from "./auth-cookies";

type HeaderBag = Record<string, string | string[] | undefined>;

type RequestLike = {
  method: string;
  path?: string;
  url?: string;
  headers: HeaderBag;
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestPath(request: RequestLike): string {
  const value = request.path ?? request.url ?? "";
  const queryIndex = value.indexOf("?");
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

function requestOrigin(headers: HeaderBag): string | undefined {
  const origin = firstHeaderValue(headers.origin);
  if (origin) {
    return origin;
  }

  const referer = firstHeaderValue(headers.referer);
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * Rejects cross-site state-changing requests that rely on the HttpOnly session cookies.
 * Safe methods and Bearer-token clients pass through, while cookie-authenticated writes must
 * come from the configured WEB_APP_URL origin; cookie-less browser requests need no origin.
 */
export function csrfRejection(request: RequestLike, env: Record<string, string | undefined> = process.env): string | undefined {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return undefined;
  }

  const authorization = firstHeaderValue(request.headers.authorization);
  if (authorization && /^Bearer /i.test(authorization)) {
    return undefined;
  }

  const cookieAuth = hasAuthCookie(request.headers);
  const authRoute = requestPath(request).startsWith("/auth/");
  if (!cookieAuth && !authRoute) {
    return undefined;
  }

  const source = requestOrigin(request.headers);
  if (!source) {
    return cookieAuth ? "Cross-site request blocked: missing Origin header" : undefined;
  }

  const allowedOrigin = new URL(env.WEB_APP_URL ?? "http://localhost:3000").origin;
  if (source !== allowedOrigin) {
    return "Cross-site request blocked: origin not allowed";
  }

  return undefined;
}

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const rejection = csrfRejection(request);
    if (rejection) {
      throw new ForbiddenException(rejection);
    }

    return true;
  }
}
