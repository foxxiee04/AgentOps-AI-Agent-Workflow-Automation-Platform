import { IsObject, IsOptional, IsString } from "class-validator";

export class TestAgentDto {
  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  modelProvider?: string;
}

