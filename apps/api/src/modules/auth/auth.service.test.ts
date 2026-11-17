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
    const user = { id: "user_1", email: "operator@agentops.local", name: "operator", workspaces: [] };
    const url = new URL(service.frontendCallbackUrl(user, "/dashboard"));

    expect(url.hash).not.toContain("accessToken");
    expect(url.hash).not.toContain("refreshToken");
    expect(Object.fromEntries(new URLSearchParams(url.hash.slice(1)))).toEqual({
      user: Buffer.from(JSON.stringify(user)).toString("base64url"),
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

describe("AuthService workspaces", () => {
  it("creates a personal workspace with an OWNER membership on register", async () => {
    const { service, workspaces, workspaceMembers } = createService();

    const session = await service.register({ email: "new@example.com", name: "New User", password: "password123" });

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({
      name: "New User's workspace",
      ownerId: session.user.id,
      plan: "FREE"
    });
    expect(workspaceMembers).toEqual([
      expect.objectContaining({ workspaceId: workspaces[0]?.id, userId: session.user.id, role: "OWNER" })
    ]);
    expect(session.user.workspaces).toEqual([
      { id: workspaces[0]?.id, name: "New User's workspace", slug: workspaces[0]?.slug, role: "OWNER" }
    ]);
  });

  it("returns the caller's workspaces ordered by membership joinedAt in /auth/me", async () => {
    const { service, workspaces, workspaceMembers } = createService();
    const session = await service.register({ email: "new@example.com", name: "New User", password: "password123" });

    const later = { id: "ws_later", name: "Second workspace", slug: "second", ownerId: session.user.id, plan: "FREE" };
    workspaces.push(later);
    workspaceMembers.push({
      id: "wsm_later",
      workspaceId: later.id,
      userId: session.user.id,
      role: "MEMBER",
      joinedAt: new Date(Date.now() + 60_000)
    });

    const me = await service.me(`Bearer ${session.accessToken}`);

    expect(me.workspaces.map((workspace) => workspace.id)).toEqual([workspaces[0]?.id, "ws_later"]);
    expect(me.workspaces[1]).toEqual({ id: "ws_later", name: "Second workspace", slug: "second", role: "MEMBER" });
  });

  it("adds a ws_demo membership with DEMO_WORKSPACE_JOIN_ROLE on register", async () => {
    const { service, workspaceMembers } = createService({
      demoWorkspace: true,
      env: { DEMO_WORKSPACE_JOIN_ROLE: "MEMBER" }
    });

    await service.register({ email: "new@example.com", name: "New User", password: "password123" });

    expect(workspaceMembers).toEqual(
      expect.arrayContaining([expect.objectContaining({ workspaceId: "ws_demo", role: "MEMBER" })])
    );
  });

  it("does not add a demo membership when DEMO_WORKSPACE_JOIN_ROLE is unset", async () => {
    const { service, workspaceMembers } = createService({ demoWorkspace: true });

    await service.register({ email: "new@example.com", name: "New User", password: "password123" });

    expect(workspaceMembers.some((member) => member.workspaceId === "ws_demo")).toBe(false);
  });
});

describe("AuthService Google sign-in", () => {
  it("creates a personal workspace with an OWNER membership on first sign-in", async () => {
    const { service, workspaces, workspaceMembers } = createService({ env: googleEnv() });
    const state = stateFor(service);
    vi.stubGlobal("fetch", googleFetch(googleClaims()));

    try {
      const result = await service.googleCallback("code", state);

      expect(result.session.user.provider).toBe("google");
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]).toMatchObject({ name: "New Googler's workspace", ownerId: result.session.user.id });
      expect(workspaceMembers).toEqual([
        expect.objectContaining({ workspaceId: workspaces[0]?.id, userId: result.session.user.id, role: "OWNER" })
      ]);
      expect(result.session.user.workspaces).toEqual([
        { id: workspaces[0]?.id, name: "New Googler's workspace", slug: workspaces[0]?.slug, role: "OWNER" }
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("gives an existing Google user no new workspace", async () => {
    const { service, workspaces, workspaceMembers } = createService({ env: googleEnv() });
    vi.stubGlobal("fetch", googleFetch(googleClaims()));

    try {
      await service.googleCallback("code", stateFor(service));
      const second = await service.googleCallback("code", stateFor(service));

      expect(workspaces).toHaveLength(1);
      expect(workspaceMembers).toHaveLength(1);
      expect(second.session.user.workspaces).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("adds a ws_demo membership with DEMO_WORKSPACE_JOIN_ROLE on first sign-in", async () => {
    const { service, workspaceMembers } = createService({
      demoWorkspace: true,
      env: { ...googleEnv(), DEMO_WORKSPACE_JOIN_ROLE: "VIEWER" }
    });
    vi.stubGlobal("fetch", googleFetch(googleClaims()));

    try {
      await service.googleCallback("code", stateFor(service));

      expect(workspaceMembers).toEqual(
        expect.arrayContaining([expect.objectContaining({ workspaceId: "ws_demo", role: "VIEWER" })])
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

async function passwordLoginFailures() {
  const text = await metricsRegistry.metrics();
  const match = text.match(/agentops_auth_logins_total\{provider="password",result="failure"\} (\d+)/);
  return Number(match?.[1] ?? 0);
}

function googleEnv(): Record<string, string> {
  return {
    GOOGLE_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:4000/auth/google/callback"
  };
}

function googleClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: "client-id",
    sub: "google-sub-1",
    email: "googler@example.com",
    email_verified: true,
    name: "New Googler",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  };
}

function googleFetch(claims: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const idToken = `${encode({ alg: "none" })}.${encode(claims)}.`;

  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ id_token: idToken })
  }));
}

function stateFor(service: AuthService): string {
  const url = new URL(service.googleAuthorizationUrl("/dashboard"));
  return url.searchParams.get("state") ?? "";
}

type HarnessOptions = {
  env?: Record<string, string | undefined>;
  demoWorkspace?: boolean;
};

function createService(options: HarnessOptions = {}) {
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
  const workspaces: Array<{ id: string; name: string; slug: string; ownerId: string; plan: string }> = [];
  const workspaceMembers: Array<{
    id: string;
    workspaceId: string;
    userId: string;
    role: string;
    joinedAt: Date;
  }> = [];

  if (options.demoWorkspace) {
    workspaces.push({ id: "ws_demo", name: "AgentOps Demo", slug: "agentops-demo", ownerId: "user_demo", plan: "FREE" });
  }

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
    update: vi.fn(async ({ where, data }: { where: { email: string }; data: Record<string, unknown> }) => {
      const user = users.find((candidate) => candidate.email === where.email);
      if (!user) {
        throw new Error("User not found");
      }
      Object.assign(user, data);
      return user;
    })
  };
  const workspaceApi = {
    create: vi.fn(async ({ data }) => {
      workspaces.push(data);
      return data;
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      workspaces.find((workspace) => workspace.id === where.id) ?? null
    )
  };
  const workspaceMemberApi = {
    create: vi.fn(async ({ data }) => {
      const member = { joinedAt: new Date(), ...data };
      workspaceMembers.push(member);
      return member;
    }),
    upsert: vi.fn(async ({ where, create }) => {
      const key = where.workspaceId_userId;
      const existing = workspaceMembers.find(
        (member) => member.workspaceId === key.workspaceId && member.userId === key.userId
      );
      if (existing) {
        return existing;
      }
      const member = { joinedAt: new Date(), ...create };
      workspaceMembers.push(member);
      return member;
    }),
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
      workspaceMembers
        .filter((member) => member.userId === where.userId)
        .map((member) => ({
          ...member,
          workspace: workspaces.find((workspace) => workspace.id === member.workspaceId)
        }))
        .filter((member) => member.workspace !== undefined)
        .sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime())
    )
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
  const env: Record<string, string | undefined> = {
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    WEB_APP_URL: "http://localhost:3000",
    API_URL: "http://localhost:4000",
    ...options.env
  };
  const config = {
    get: vi.fn((key: string) => env[key])
  };

  return {
    service: new AuthService(
      { client } as never,
      { ensureDemoWorkspace: vi.fn(async () => undefined), ensureDemoWorkflow: vi.fn(async () => undefined) } as never,
      new JwtService(),
      config as never
    ),
    users,
    refreshTokens,
    workspaces,
    workspaceMembers
  };
}
