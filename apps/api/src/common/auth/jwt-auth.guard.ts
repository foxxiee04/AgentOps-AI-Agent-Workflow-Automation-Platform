import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../../modules/auth/auth.service";
import { requestAuthorization } from "./auth-cookies";
import { IS_PUBLIC_KEY } from "./public.decorator";

export type AuthenticatedCaller = {
  userId: string;
  email: string;
};

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  auth?: AuthenticatedCaller;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    // Verifies the Bearer header or access cookie; a missing/invalid token propagates as 401.
    const caller = await this.auth.authenticate(requestAuthorization(request.headers));
    request.auth = caller;
    return true;
  }
}
