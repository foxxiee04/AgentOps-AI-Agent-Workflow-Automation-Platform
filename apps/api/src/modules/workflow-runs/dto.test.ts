import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { ApprovalDecisionDto } from "./dto";

describe("ApprovalDecisionDto", () => {
  it("accepts an approval without a comment", async () => {
    expect(await validate(plainToInstance(ApprovalDecisionDto, { decision: "approve" }))).toEqual([]);
  });

  it("accepts an approval with a comment and an edited email", async () => {
    const dto = plainToInstance(ApprovalDecisionDto, {
      decision: "approve",
      comment: "looks good",
      editedEmail: { subject: "Hi Anna", body: "Hello there" }
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.editedEmail).toMatchObject({ subject: "Hi Anna", body: "Hello there" });
  });

  it("requires a reason when rejecting", async () => {
    const errors = await validate(plainToInstance(ApprovalDecisionDto, { decision: "reject" }));

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints).toMatchObject({ rejectionReason: expect.any(String) });
  });

  it("rejects a reason that is too short or only spaces", async () => {
    expect(await validate(plainToInstance(ApprovalDecisionDto, { decision: "reject", comment: "ab" }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(ApprovalDecisionDto, { decision: "reject", comment: "   " }))).not.toHaveLength(0);
  });

  it("accepts a rejection with a reason", async () => {
    expect(await validate(plainToInstance(ApprovalDecisionDto, { decision: "reject", comment: "wrong tone" }))).toEqual([]);
  });

  it("rejects an edited email with an empty subject or body", async () => {
    expect(
      await validate(plainToInstance(ApprovalDecisionDto, { decision: "approve", editedEmail: { subject: "", body: "Hi" } }))
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(ApprovalDecisionDto, { decision: "approve", editedEmail: { subject: "Hi", body: "" } }))
    ).not.toHaveLength(0);
  });

  it("rejects an unknown decision", async () => {
    expect(await validate(plainToInstance(ApprovalDecisionDto, { decision: "maybe" }))).not.toHaveLength(0);
  });
});
