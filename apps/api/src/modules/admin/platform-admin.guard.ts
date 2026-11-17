import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { PrismaService } from "../../common/infrastructure/prisma.service";

type RequestLike = { auth?: AuthenticatedCaller };

/**
 * Allows only platform administrators. Runs after the global JwtAuthGuard (which sets `request.auth`
 * and already refuses disabled accounts) and re-reads the flag from the database on every request,
 * so a demoted admin loses access immediately.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (!request.auth) {
      throw new UnauthorizedException("Missing session");
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: request.auth.userId },
      select: { isPlatformAdmin: true, disabledAt: true }
    });
    if (!user || user.disabledAt || !user.isPlatformAdmin) {
      throw new ForbiddenException("Platform administrator role required");
    }

    return true;
  }
}
