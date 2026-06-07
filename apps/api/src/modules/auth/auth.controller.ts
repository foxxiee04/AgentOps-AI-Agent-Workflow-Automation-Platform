import { Body, Controller, Get, Headers, Post, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  refresh() {
    return { accessToken: "mock_access_refreshed" };
  }

  @Post("logout")
  logout() {
    return { success: true };
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    return this.authService.me(authorization);
  }

  @Get("google")
  google(@Query("redirectTo") redirectTo: string | undefined, @Res() response: Response) {
    try {
      response.redirect(this.authService.googleAuthorizationUrl(redirectTo));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google OAuth is not configured";
      response.redirect(this.authService.frontendAuthErrorUrl(message));
    }
  }

  @Get("google/callback")
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
      response.redirect(this.authService.frontendCallbackUrl(result.session, result.redirectTo));
    } catch (callbackError) {
      const message = callbackError instanceof Error ? callbackError.message : "Google OAuth failed";
      response.redirect(this.authService.frontendAuthErrorUrl(message));
    }
  }
}
