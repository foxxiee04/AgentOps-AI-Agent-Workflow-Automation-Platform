import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
  me() {
    return this.authService.me();
  }
}

