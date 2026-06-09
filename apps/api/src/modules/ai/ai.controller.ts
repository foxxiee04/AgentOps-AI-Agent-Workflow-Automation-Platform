import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AiService } from "./ai.service";
import { EvaluateAgentDto, TestAgentDto } from "./dto";

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
  task(@Param("id") id: string) {
    return { id, status: "mock_completed" };
  }

  @Get("usage")
  usage() {
    return this.aiService.usage();
  }
}
