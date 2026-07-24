import { ServiceUnavailableException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

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

  it("requires Google OAuth credentials before building an authorization URL", () => {
    const { service } = createService();

    expect(() => service.googleAuthorizationUrl("/dashboard?lang=en")).toThrow(ServiceUnavailableException);
  });
});

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
      { ensureDemoWorkspace: vi.fn(async () => undefined) } as never,
      new JwtService(),
      config as never
    ),
    users,
    refreshTokens
  };
}
