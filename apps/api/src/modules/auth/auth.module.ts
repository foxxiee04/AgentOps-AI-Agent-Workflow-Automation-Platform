import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [InfrastructureModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
