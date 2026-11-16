import { Body, Controller, Get, Inject, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  clearAuthCookies,
  readCookie,
  refreshCookieName,
  requestAuthorization,
  sessionResponseBody,
  setAuthCookies
} from "../../common/auth/auth-cookies";
import { Public } from "../../common/auth/public.decorator";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshTokenDto, RegisterDto } from "./dto";
import { clearSessionHintCookie, setSessionHintCookie } from "./session-hint";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  @Throttle({ default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 10, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.authService.register(dto);
    setAuthCookies(response, session);
    setSessionHintCookie(response);
    return sessionResponseBody(session, request.headers);
  }

  @Post("login")
  @Public()
  @Throttle({ default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto);
    setAuthCookies(response, session);
    setSessionHintCookie(response);
    return sessionResponseBody(session, request.headers);
  }

  @Post("refresh")
  @Public()
  @Throttle({ default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 10, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = dto.refreshToken ?? readCookie(request.headers, refreshCookieName);
    if (!refreshToken) {
      clearSessionHintCookie(response);
      throw new UnauthorizedException("Missing refresh token");
    }

    const session = await this.authService.refresh({ refreshToken }).catch((error: unknown) => {
      clearSessionHintCookie(response);
      throw error;
    });

    setAuthCookies(response, session);
    setSessionHintCookie(response);
    return sessionResponseBody(session, request.headers);
  }

  @Post("logout")
  @Public()
  async logout(
    @Body() dto: Partial<RefreshTokenDto> | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = dto?.refreshToken ?? readCookie(request.headers, refreshCookieName);
    const result = await this.authService.logout(refreshToken ? { refreshToken } : undefined);
    clearAuthCookies(response);
    clearSessionHintCookie(response);
    return result;
  }

  @Get("me")
  me(@Req() request: Request) {
    return this.authService.me(requestAuthorization(request.headers));
  }

  @Get("google")
  @Public()
  google(@Query("redirectTo") redirectTo: string | undefined, @Res() response: Response) {
    try {
      response.redirect(this.authService.googleAuthorizationUrl(redirectTo));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google OAuth is not configured";
      response.redirect(this.authService.frontendAuthErrorUrl(message));
    }
  }

  @Get("google/callback")
  @Public()
  async googleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() response: Response
  ) {
    if (error) {
      response.redirect(this.authService.frontendAuthErrorUrl(error));
      return;
    }

    try {
      const result = await this.authService.googleCallback(code ?? "", state ?? "");
      setAuthCookies(response, result.session);
      setSessionHintCookie(response);
      response.redirect(this.authService.frontendCallbackUrl(result.session.user, result.redirectTo));
    } catch (callbackError) {
      const message = callbackError instanceof Error ? callbackError.message : "Google OAuth failed";
      response.redirect(this.authService.frontendAuthErrorUrl(message));
    }
  }
}
