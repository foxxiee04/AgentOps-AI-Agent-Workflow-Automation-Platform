import { IsNotEmpty, IsString } from "class-validator";

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  workflowId!: string;
}
