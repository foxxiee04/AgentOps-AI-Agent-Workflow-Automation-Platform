import { Type } from "class-transformer";
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

export class TestAgentDto {
  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  modelProvider?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class AiEvaluationCaseDto {
  @IsString()
  id!: string;

  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  expected?: Record<string, unknown>;
}

export class EvaluateAgentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiEvaluationCaseDto)
  testCases!: AiEvaluationCaseDto[];

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
