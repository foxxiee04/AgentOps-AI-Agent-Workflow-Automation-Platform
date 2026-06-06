import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateWebhookDto } from "./dto";

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly endpoints = [
    {
      id: "wh_demo",
      workflowId: "wf_lead_qualification",
      workspaceId: "ws_demo",
      isActive: true
    }
  ];

  @Post(":workflowId")
  receive(@Param("workflowId") workflowId: string, @Body() body: Record<string, unknown>) {
    return {
      workflowId,
      accepted: true,
      mode: "mock",
      body
    };
  }

  @Get()
  findAll() {
    return this.endpoints;
  }

  @Post()
  create(@Body() dto: CreateWebhookDto) {
    const endpoint = {
      id: `wh_${Date.now()}`,
      workflowId: dto.workflowId,
      workspaceId: dto.workspaceId,
      isActive: true
    };
    this.endpoints.push(endpoint);
    return endpoint;
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return { id, deleted: true };
  }
}

