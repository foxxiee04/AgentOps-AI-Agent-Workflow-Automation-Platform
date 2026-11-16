import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { metricsRegistry } from "../../common/metrics/api-metrics";
import { AuthService } from "./auth.service";

// Real argon2 at minimal cost: the library defaults (64 MiB, t=3, p=4) push login tests past 5 s under CPU load.
vi.mock("argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("argon2")>();
  const hash = ((password: string, options?: object) =>
    actual.hash(password, { ...options, memoryCost: 1024, timeCost: 1, parallelism: 1 })) as typeof actual.hash;
  return { ...actual, hash };
});

describe("AuthService", () => {
  it("issues JWT sessions and resolves the current user from PostgreSQL-backed auth state", async () => {
    const { service, users, refreshTokens } = createService();
    const session = await service.login({
      email: "operator@agentops.local",
      password: "password123"
    });

    expect(session.accessToken.split(".")).toHaveLength(3);
    expect(session.refreshToken).toMatch(/^rfr_/);
    expect(users).toHaveLength(1);
    expect(users[0]?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=1024,t=1,p=1\$/);
    expect(refreshTokens).toHaveLength(1);
    await expect(service.me(`Bearer ${session.accessToken}`)).resolves.toMatchObject({
      email: "operator@agentops.local",
      name: "operator"
    });
  });

  it("rotates refresh tokens", async () => {
    const { service, refreshTokens } = createService();
    const session = await service.login({
      email: "operator@agentops.local",
      password: "password123"
    });
    const refreshed = await service.refresh({ refreshToken: session.refreshToken });

    expect(refreshed.accessToken.split(".")).toHaveLength(3);
    expect(refreshed.refreshToken).not.toBe(session.refreshToken);
    expect(refreshTokens[0]?.revokedAt).toBeInstanceOf(Date);
  });

  it("gives local demo users distinct ids even when their emails share a long prefix", async () => {
    const { service, users } = createService();
    await service.login({ email: "e2e-1792336558330@agentops.local", password: "password123" });
    await service.login({ email: "e2e-1792336558331@agentops.local", password: "password123" });

    expect(users).toHaveLength(2);
    expect(new Set(users.map((user) => user.id)).size).toBe(2);
  });

  it("rejects unknown @agentops.local logins outside local environments", async () => {
    const previousAppEnv = process.env.APP_ENV;
    const previousDemoLogin = process.env.DEMO_LOGIN_ENABLED;
    process.env.APP_ENV = "prod";
    delete process.env.DEMO_LOGIN_ENABLED;

    try {
      const { service, users } = createService();

      await expect(service.login({ email: "intruder@agentops.local", password: "password123" })).rejects.toBeInstanceOf(
        UnauthorizedException
      );
      expect(users).toHaveLength(0);
    } finally {
      if (previousAppEnv === undefined) {
        delete process.env.APP_ENV;
      } else {
        process.env.APP_ENV = previousAppEnv;
      }
      if (previousDemoLogin === undefined) {
        delete process.env.DEMO_LOGIN_ENABLED;
      } else {
        process.env.DEMO_LOGIN_ENABLED = previousDemoLogin;
      }
    }
  });

  it("authenticates bearer tokens for protected endpoints", async () => {
    const { service } = createService();
    const session = await service.login({ email: "operator@agentops.local", password: "password123" });

    await expect(service.authenticate(`Bearer ${session.accessToken}`)).resolves.toMatchObject({ email: "operator@agentops.local" });
    await expect(service.authenticate(undefined)).rejects.toThrow("Missing bearer token");
    await expect(service.authenticate("Bearer not-a-jwt")).rejects.toThrow("invalid or expired");
  });

  it("puts only the user and redirect target in the frontend callback fragment", () => {
    const { service } = createService();
    const url = new URL(
      service.frontendCallbackUrl({ id: "user_1", email: "operator@agentops.local", name: "operator" }, "/dashboard")
    );

    expect(url.hash).not.toContain("accessToken");
    expect(url.hash).not.toContain("refreshToken");
    expect(Object.fromEntries(new URLSearchParams(url.hash.slice(1)))).toEqual({
      user: Buffer.from(JSON.stringify({ id: "user_1", email: "operator@agentops.local", name: "operator" })).toString("base64url"),
      redirectTo: "/dashboard"
    });
  });

  it("requires Google OAuth credentials before building an authorization URL", () => {
    const { service } = createService();

    expect(() => service.googleAuthorizationUrl("/dashboard?lang=en")).toThrow(ServiceUnavailableException);
  });

  it("increments the login failure counter when credentials are wrong", async () => {
    const { service } = createService();
    const before = await passwordLoginFailures();

    await expect(service.login({ email: "nobody@example.com", password: "password123" })).rejects.toThrow("Invalid email or password");

    expect(await passwordLoginFailures()).toBe(before + 1);
  });
});

async function passwordLoginFailures() {
  const text = await metricsRegistry.metrics();
  const match = text.match(/agentops_auth_logins_total\{provider="password",result="failure"\} (\d+)/);
  return Number(match?.[1] ?? 0);
}

function createService() {
  const users: Array<{
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const refreshTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
  }> = [];
  const workspaces: unknown[] = [];
  const workspaceMembers: unknown[] = [];
  const userApi = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
      users.find((user) => (where.id ? user.id === where.id : user.email === where.email)) ?? null
    ),
    create: vi.fn(async ({ data }) => {
      const user = {
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      users.push(user);
      return user;
    }),
    upsert: vi.fn()
  };
  const workspaceApi = {
    create: vi.fn(async ({ data }) => {
      workspaces.push(data);
      return data;
    })
  };
  const workspaceMemberApi = {
    create: vi.fn(async ({ data }) => {
      workspaceMembers.push(data);
      return data;
    }),
    upsert: vi.fn(async ({ create }) => {
      workspaceMembers.push(create);
      return create;
    })
  };
  const authRefreshTokenApi = {
    create: vi.fn(async ({ data }) => {
      const token = {
        id: `rft_${refreshTokens.length + 1}`,
        revokedAt: null,
        createdAt: new Date(),
        ...data
      };
      refreshTokens.push(token);
      return token;
    }),
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      const token = refreshTokens.find((candidate) => candidate.tokenHash === where.tokenHash);
      const user = token ? users.find((candidate) => candidate.id === token.userId) : undefined;
      return token && user ? { ...token, user } : null;
    }),
    update: vi.fn(async ({ where, data }) => {
      const token = refreshTokens.find((candidate) => candidate.id === where.id);
      if (token) {
        Object.assign(token, data);
      }
      return token;
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      for (const token of refreshTokens) {
        if (token.tokenHash === where.tokenHash && token.revokedAt === where.revokedAt) {
          Object.assign(token, data);
        }
      }
      return { count: 1 };
    })
  };
  const client = {
    user: userApi,
    workspace: workspaceApi,
    workspaceMember: workspaceMemberApi,
    authRefreshToken: authRefreshTokenApi,
    $transaction: vi.fn(async (callback) => callback(client))
  };
  const config = {
    get: vi.fn((key: string) => {
      const env: Record<string, string | undefined> = {
        JWT_ACCESS_SECRET: "test-access-secret",
        JWT_REFRESH_SECRET: "test-refresh-secret",
        WEB_APP_URL: "http://localhost:3000",
        API_URL: "http://localhost:4000"
      };
      return env[key];
    })
  };

  return {
    service: new AuthService(
      { client } as never,
      { ensureDemoWorkspace: vi.fn(async () => undefined), ensureDemoWorkflow: vi.fn(async () => undefined) } as never,
      new JwtService(),
      config as never
    ),
    users,
    refreshTokens
  };
}
