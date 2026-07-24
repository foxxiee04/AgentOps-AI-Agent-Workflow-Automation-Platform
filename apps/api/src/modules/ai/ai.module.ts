import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../common/infrastructure/infrastructure.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [AiController],
  providers: [AiService]
})
export class AiModule {}
