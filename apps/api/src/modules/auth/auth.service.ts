import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DemoDataService, demoWorkspaceId } from "../../common/infrastructure/demo-data.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import { recordLogin, recordRegistration } from "../../common/metrics/api-metrics";
import { isDemoLoginEnabled } from "./demo-login";
import type { LoginDto, RefreshTokenDto, RegisterDto } from "./dto";

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

type AccessTokenClaims = {
  sub: string;
  email: string;
  type: "access";
};

type UserRecord = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  passwordHash: string;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoDataService) private readonly demoData: DemoDataService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.client.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.client.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          id: `user_${randomUUID()}`,
          email,
          name: dto.name,
          passwordHash
        }
      });
      const workspace = await tx.workspace.create({
        data: {
          id: `ws_${randomUUID()}`,
          name: `${dto.name}'s workspace`,
          slug: this.workspaceSlug(dto.name),
          ownerId: createdUser.id,
          plan: "FREE"
        }
      });
      await tx.workspaceMember.create({
        data: {
          id: `wsm_${randomUUID()}`,
          workspaceId: workspace.id,
          userId: createdUser.id,
          role: "OWNER"
        }
      });

      return createdUser;
    });

    recordRegistration("password");
    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = (await this.prisma.client.user.findUnique({ where: { email } })) ?? (await this.createLocalDemoUser(dto));
    if (!user || !(await this.verifyPassword(user, dto.password))) {
      recordLogin("password", "failure");
      throw new UnauthorizedException("Invalid email or password");
    }

    recordLogin("password", "success");
    return this.issueSession(user);
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const storedToken = await this.prisma.client.authRefreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    await this.prisma.client.authRefreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    return this.issueSession(storedToken.user);
  }

  async logout(dto?: Partial<RefreshTokenDto>) {
    if (dto?.refreshToken) {
      await this.prisma.client.authRefreshToken.updateMany({
        where: { tokenHash: this.hashRefreshToken(dto.refreshToken), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    return { success: true };
  }

  /**
   * Verifies a `Bearer <jwt>` value taken from the Authorization header or the access cookie
   * and returns the caller; throws 401 otherwise.
   */
  async authenticate(authorization?: string): Promise<{ userId: string; email: string }> {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const claims = await this.verifyAccessToken(token);
    return { userId: claims.sub, email: claims.email };
  }

  async me(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const claims = await this.verifyAccessToken(token);
    const user = await this.prisma.client.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    return this.toAuthUser(user);
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
    const email = this.normalizeEmail(claims.email);
    const existingUser = await this.prisma.client.user.findUnique({ where: { email } });
    const user = await this.prisma.client.user.upsert({
      where: { email },
      update: {
        name: claims.name ?? claims.email.split("@")[0],
        avatarUrl: claims.picture
      },
      create: {
        id: `user_google_${claims.sub}`,
        email,
        name: claims.name ?? claims.email.split("@")[0],
        avatarUrl: claims.picture,
        passwordHash: "google-oauth-password-disabled"
      }
    });
    const session = await this.issueSession(user, "google");
    recordLogin("google", "success");
    if (!existingUser) {
      recordRegistration("google");
    }

    return {
      redirectTo: parsedState.redirectTo,
      session
    };
  }

  frontendCallbackUrl(user: AuthUser, redirectTo: string) {
    const url = new URL("/auth/callback", this.webAppUrl());
    const fragment = new URLSearchParams({
      user: Buffer.from(JSON.stringify(user)).toString("base64url"),
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

  private async createLocalDemoUser(dto: LoginDto): Promise<UserRecord | undefined> {
    if (!isDemoLoginEnabled()) {
      return undefined;
    }

    const email = this.normalizeEmail(dto.email);
    if (!email.endsWith("@agentops.local")) {
      return undefined;
    }

    // The workflow too, not just the workspace: WorkspaceRoleGuard resolves `wf_lead_qualification`
    // before the service would lazily create it, so on an empty database the first run would 404.
    await this.demoData.ensureDemoWorkflow();
    const user = await this.prisma.client.user.create({
      data: {
        // Hash of the full email: a prefix of it collided for emails sharing their first characters.
        id: `user_${createHash("sha256").update(email).digest("hex").slice(0, 20)}`,
        email,
        name: email.split("@")[0],
        passwordHash: await argon2.hash(dto.password)
      }
    });
    await this.prisma.client.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: demoWorkspaceId,
          userId: user.id
        }
      },
      update: {},
      create: {
        id: `wsm_${randomUUID()}`,
        workspaceId: demoWorkspaceId,
        userId: user.id,
        role: "OWNER"
      }
    });

    return user;
  }

  private async verifyPassword(user: UserRecord, password: string) {
    if (user.passwordHash.endsWith("password-disabled")) {
      return false;
    }

    return argon2.verify(user.passwordHash, password);
  }

  private async issueSession(user: Omit<UserRecord, "passwordHash">, provider: "password" | "google" = "password"): Promise<AuthSession> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        type: "access"
      } satisfies AccessTokenClaims,
      {
        secret: this.accessSecret(),
        expiresIn: "15m"
      }
    );
    const refreshToken = `rfr_${randomUUID()}_${randomUUID()}`;
    await this.prisma.client.authRefreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000)
      }
    });

    return {
      user: {
        ...this.toAuthUser(user),
        provider
      },
      accessToken,
      refreshToken
    };
  }

  private async verifyAccessToken(token: string) {
    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, { secret: this.accessSecret() });
      if (claims.type !== "access") {
        throw new UnauthorizedException("Invalid token type");
      }

      return claims;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Access token is invalid or expired");
    }
  }

  private toAuthUser(user: Omit<UserRecord, "passwordHash">): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt.toISOString()
    };
  }

  private hashRefreshToken(token: string) {
    return createHash("sha256").update(`${this.refreshSecret()}:${token}`).digest("hex");
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private workspaceSlug(name: string) {
    return `${name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)}-${randomUUID().slice(0, 8)}`;
  }

  private googleConfig() {
    const clientId = this.config.get<string>("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_OAUTH_CLIENT_SECRET");
    const redirectUri =
      this.config.get<string>("GOOGLE_OAUTH_REDIRECT_URI") ??
      `${this.config.get<string>("API_URL") ?? "http://localhost:4000"}/auth/google/callback`;

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException("Google OAuth is not configured");
    }

    return { clientId, clientSecret, redirectUri };
  }

  private webAppUrl() {
    return this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";
  }

  private accessSecret() {
    return this.config.get<string>("JWT_ACCESS_SECRET") ?? process.env.JWT_ACCESS_SECRET ?? "replace-me-access";
  }

  private refreshSecret() {
    return this.config.get<string>("JWT_REFRESH_SECRET") ?? process.env.JWT_REFRESH_SECRET ?? "replace-me-refresh";
  }

  private safeRedirectPath(input?: string) {
    if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("://")) {
      return "/dashboard";
    }

    return input;
  }

  private signState(payload: OAuthState) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.accessSecret()).update(encodedPayload).digest("base64url");
    return `${encodedPayload}.${signature}`;
  }

  private verifyState(state: string): OAuthState {
    const [encodedPayload, signature] = state.split(".");
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid OAuth state");
    }

    const expected = createHmac("sha256", this.accessSecret()).update(encodedPayload).digest("base64url");
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
