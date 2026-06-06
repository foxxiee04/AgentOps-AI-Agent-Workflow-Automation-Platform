import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  slug!: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

export class InviteWorkspaceMemberDto {
  @IsString()
  email!: string;

  @IsIn(["ADMIN", "MEMBER", "VIEWER"])
  role!: "ADMIN" | "MEMBER" | "VIEWER";
}

export class UpdateWorkspaceMemberRoleDto {
  @IsIn(["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  role!: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

