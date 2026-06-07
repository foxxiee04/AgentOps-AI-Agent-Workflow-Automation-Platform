import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const previousGoogleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const previousGoogleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  afterEach(() => {
    restoreEnv("GOOGLE_OAUTH_CLIENT_ID", previousGoogleClientId);
    restoreEnv("GOOGLE_OAUTH_CLIENT_SECRET", previousGoogleClientSecret);
  });

  it("issues a session and resolves the current user from a bearer token", () => {
    const service = new AuthService();
    const session = service.login({
      email: "operator@agentops.local",
      password: "password123"
    });

    expect(session.accessToken).toMatch(/^mock_access_/);
    expect(service.me(`Bearer ${session.accessToken}`)).toMatchObject({
      email: "operator@agentops.local",
      name: "operator"
    });
  });

  it("requires Google OAuth credentials before building an authorization URL", () => {
    const service = new AuthService();

    expect(() => service.googleAuthorizationUrl("/dashboard?lang=en")).toThrow(ServiceUnavailableException);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
