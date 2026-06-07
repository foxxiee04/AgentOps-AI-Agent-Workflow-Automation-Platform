import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { LoginDto, RegisterDto } from "./dto";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider?: "password" | "google";
  createdAt?: string;
};

type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdTokenClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  exp?: number;
};

type OAuthState = {
  nonce: string;
  redirectTo: string;
  exp: number;
};

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, AuthSession>();

  register(dto: RegisterDto) {
    const user = {
      id: `user_${randomUUID()}`,
      email: dto.email,
      name: dto.name,
      provider: "password" as const,
      createdAt: new Date().toISOString()
    };

    return this.issueSession(user);
  }

  login(dto: LoginDto) {
    const userId = `user_${Buffer.from(dto.email).toString("base64url").slice(0, 12)}`;
    return this.issueSession({
      id: userId,
      email: dto.email,
      name: dto.email.split("@")[0],
      provider: "password"
    });
  }

  me(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    const session = token ? this.sessions.get(token) : undefined;

    return (
      session?.user ?? {
        id: "user_demo",
        email: "demo@agentops.local",
        name: "Demo Operator",
        provider: "password" as const
      }
    );
  }

  googleAuthorizationUrl(redirectTo?: string) {
    const config = this.googleConfig();
    const state = this.signState({
      nonce: randomUUID(),
      redirectTo: this.safeRedirectPath(redirectTo),
      exp: Date.now() + 10 * 60_000
    });
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account"
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async googleCallback(code: string, state: string) {
    if (!code || !state) {
      throw new BadRequestException("Missing Google OAuth callback parameters");
    }

    const config = this.googleConfig();
    const parsedState = this.verifyState(state);
    const tokenResponse = await this.exchangeGoogleCode(code, config);
    if (!tokenResponse.id_token) {
      throw new UnauthorizedException(tokenResponse.error_description ?? tokenResponse.error ?? "Google did not return an ID token");
    }

    const claims = this.decodeGoogleIdToken(tokenResponse.id_token, config.clientId);
    const session = this.issueSession({
      id: `user_google_${claims.sub}`,
      email: claims.email,
      name: claims.name ?? claims.email.split("@")[0],
      avatarUrl: claims.picture,
      provider: "google"
    });

    return {
      redirectTo: parsedState.redirectTo,
      session
    };
  }

  frontendCallbackUrl(session: AuthSession, redirectTo: string) {
    const url = new URL("/auth/callback", this.webAppUrl());
    const fragment = new URLSearchParams({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: Buffer.from(JSON.stringify(session.user)).toString("base64url"),
      redirectTo
    });
    url.hash = fragment.toString();
    return url.toString();
  }

  frontendAuthErrorUrl(error: string) {
    const url = new URL("/login", this.webAppUrl());
    url.searchParams.set("authError", error);
    return url.toString();
  }

  private issueSession(user: AuthUser): AuthSession {
    const session = {
      user: {
        ...user
      },
      accessToken: `mock_access_${user.id}_${randomUUID()}`,
      refreshToken: `mock_refresh_${user.id}_${randomUUID()}`
    };
    this.sessions.set(session.accessToken, session);
    return session;
  }

  private googleConfig() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${process.env.API_URL ?? "http://localhost:4000"}/auth/google/callback`;

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException("Google OAuth is not configured");
    }

    return { clientId, clientSecret, redirectUri };
  }

  private webAppUrl() {
    return process.env.WEB_APP_URL ?? "http://localhost:3000";
  }

  private safeRedirectPath(input?: string) {
    if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("://")) {
      return "/dashboard";
    }

    return input;
  }

  private signState(payload: OAuthState) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.stateSecret()).update(encodedPayload).digest("base64url");
    return `${encodedPayload}.${signature}`;
  }

  private verifyState(state: string): OAuthState {
    const [encodedPayload, signature] = state.split(".");
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid OAuth state");
    }

    const expected = createHmac("sha256", this.stateSecret()).update(encodedPayload).digest("base64url");
    if (!this.safeEqual(signature, expected)) {
      throw new UnauthorizedException("Invalid OAuth state signature");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OAuthState;
    if (!payload.exp || payload.exp < Date.now()) {
      throw new UnauthorizedException("OAuth state expired");
    }

    return {
      nonce: payload.nonce,
      redirectTo: this.safeRedirectPath(payload.redirectTo),
      exp: payload.exp
    };
  }

  private stateSecret() {
    return process.env.JWT_ACCESS_SECRET ?? "replace-me-access";
  }

  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private async exchangeGoogleCode(code: string, config: { clientId: string; clientSecret: string; redirectUri: string }) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code"
      })
    });
    const payload = (await response.json()) as GoogleTokenResponse;

    if (!response.ok) {
      throw new UnauthorizedException(payload.error_description ?? payload.error ?? "Google OAuth token exchange failed");
    }

    return payload;
  }

  private decodeGoogleIdToken(idToken: string, clientId: string): Required<Pick<GoogleIdTokenClaims, "sub" | "email">> &
    GoogleIdTokenClaims {
    const [, encodedPayload] = idToken.split(".");
    if (!encodedPayload) {
      throw new UnauthorizedException("Invalid Google ID token");
    }

    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GoogleIdTokenClaims;
    const issuerValid = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    const emailVerified = claims.email_verified === true || claims.email_verified === "true";

    if (!issuerValid || claims.aud !== clientId || !claims.sub || !claims.email || !emailVerified || !claims.exp || claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException("Google ID token claims are invalid");
    }

    return claims as Required<Pick<GoogleIdTokenClaims, "sub" | "email">> & GoogleIdTokenClaims;
  }
}
