import { IsString } from "class-validator";

export class CreateWebhookDto {
  @IsString()
  workflowId!: string;

  @IsString()
  workspaceId!: string;
}

