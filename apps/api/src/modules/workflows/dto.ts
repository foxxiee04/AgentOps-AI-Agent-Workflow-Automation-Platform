import { Type } from "class-transformer";
import { IsArray, IsObject, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

export class WorkflowNodeDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsString()
  name!: string;

  @IsObject()
  config!: Record<string, unknown>;
}

export class WorkflowEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsString()
  condition?: string;
}

export class WorkflowDefinitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges!: WorkflowEdgeDto[];
}

export class CreateWorkflowDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  workspaceId!: string;

  @ValidateNested()
  @Type(() => WorkflowDefinitionDto)
  definition!: WorkflowDefinitionDto;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowDefinitionDto)
  definition?: WorkflowDefinitionDto;
}

export class RunWorkflowDto {
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  triggerType?: string;
}

