import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthenticatedCaller } from "../../common/auth/jwt-auth.guard";
import { AiService } from "./ai.service";
import { EvaluateAgentDto, TestAgentDto } from "./dto";

type RequestWithAuth = {
  auth?: AuthenticatedCaller;
};

@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Post("test-agent")
  testAgent(@Body() dto: TestAgentDto) {
    return this.aiService.testAgent(dto);
  }

  @Post("evaluate-agent")
  evaluateAgent(@Body() dto: EvaluateAgentDto) {
    return this.aiService.evaluateAgent(dto);
  }

  @Get("providers")
  providers() {
    return this.aiService.providers();
  }

  @Get("tasks/:id")
  task(@Param("id") id: string, @Req() request: RequestWithAuth) {
    return this.aiService.getTask(id, request.auth);
  }

  @Get("usage")
  usage() {
    return this.aiService.usage();
  }
}
