import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { LoginDto, RegisterDto } from "./dto";

@Injectable()
export class AuthService {
  register(dto: RegisterDto) {
    const user = {
      id: `user_${randomUUID()}`,
      email: dto.email,
      name: dto.name,
      createdAt: new Date().toISOString()
    };

    return {
      user,
      accessToken: `mock_access_${user.id}`,
      refreshToken: `mock_refresh_${user.id}`
    };
  }

  login(dto: LoginDto) {
    const userId = `user_${Buffer.from(dto.email).toString("base64url").slice(0, 12)}`;
    return {
      user: {
        id: userId,
        email: dto.email,
        name: dto.email.split("@")[0]
      },
      accessToken: `mock_access_${userId}`,
      refreshToken: `mock_refresh_${userId}`
    };
  }

  me() {
    return {
      id: "user_demo",
      email: "demo@agentops.local",
      name: "Demo Operator"
    };
  }
}

