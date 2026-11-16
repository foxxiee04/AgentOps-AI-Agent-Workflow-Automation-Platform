import { Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  type ValidationArguments
} from "class-validator";

/** The email a reviewer may edit before approving. */
export class EditedEmailDto {
  @IsString()
  @Length(1, 300)
  subject!: string;

  @IsString()
  @Length(1, 10000)
  body!: string;
}

/**
 * Rejecting needs a reason: at least 3 non-space characters. Approving may leave it empty.
 */
@ValidatorConstraint({ name: "rejectionReason", async: false })
export class RejectionReasonConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ApprovalDecisionDto;
    if (dto.decision !== "reject") {
      return true;
    }
    return typeof dto.comment === "string" && dto.comment.trim().length >= 3;
  }

  defaultMessage(): string {
    return "rejecting an approval requires a reason of at least 3 characters";
  }
}

export class ApprovalDecisionDto {
  @IsIn(["approve", "reject"])
  @Validate(RejectionReasonConstraint)
  decision!: "approve" | "reject";

  /** Optional for approve, mandatory for reject. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  /** The reviewer's edited email; only meaningful when approving. */
  @IsOptional()
  @ValidateNested()
  @Type(() => EditedEmailDto)
  editedEmail?: EditedEmailDto;
}
