import { Injectable } from "@nestjs/common";
import { leadScoreResultSchema, maskSensitivePromptInput } from "@agentops/shared";
import type { TestAgentDto } from "./dto";

@Injectable()
export class AiService {
  testAgent(dto: TestAgentDto) {
    const safeInput = maskSensitivePromptInput(dto.input);
    const result = leadScoreResultSchema.parse({
      leadScore: 87,
      category: "high-intent",
      summary: "The lead appears interested in automating sales and support workflows.",
      recommendedAction: "Send a personalized follow-up email and create a sales task.",
      personalizedEmail: "Hi there, thanks for reaching out about workflow automation. I would love to learn more."
    });

    return {
      provider: dto.modelProvider ?? "mock",
      safeInput,
      result,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0
      }
    };
  }

  usage() {
    return {
      workspaceId: "ws_demo",
      dailyAiCallLimit: 100,
      aiCallsToday: 1,
      tokensUsedToday: 0
    };
  }
}

