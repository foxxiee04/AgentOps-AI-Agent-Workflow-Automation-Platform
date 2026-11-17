import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export const REPORT_RANGES = [7, 30, 90] as const;
export const USER_STATUSES = ["all", "active", "disabled", "admin"] as const;
export const REPORT_TYPES = ["users", "workspaces", "runs", "usage"] as const;

export type UserStatusFilter = (typeof USER_STATUSES)[number];
export type ReportType = (typeof REPORT_TYPES)[number];

export class RangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(REPORT_RANGES as unknown as number[])
  days?: number;
}

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class UsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(USER_STATUSES as unknown as string[])
  status?: UserStatusFilter;
}

export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isPlatformAdmin?: boolean;
}
