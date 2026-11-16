import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { UpdateSalesTaskDto, WorkflowRunsQueryDto } from "./dto";

describe("WorkflowRunsQueryDto", () => {
  it("accepts a valid filter set and converts paging values to numbers", async () => {
    const dto = plainToInstance(WorkflowRunsQueryDto, { limit: "25", offset: "50", status: "FAILED", workflowId: "wf_1" });

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(50);
    expect(dto.status).toBe("FAILED");
    expect(dto.workflowId).toBe("wf_1");
  });

  it("accepts an empty query", async () => {
    const dto = plainToInstance(WorkflowRunsQueryDto, {});

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(dto.limit).toBeUndefined();
    expect(dto.offset).toBeUndefined();
  });

  it("rejects a limit outside 1..200", async () => {
    expect(await errorsFor({ limit: "0" })).not.toHaveLength(0);
    expect(await errorsFor({ limit: "201" })).not.toHaveLength(0);
    expect(await errorsFor({ limit: "abc" })).not.toHaveLength(0);
  });

  it("rejects a negative offset", async () => {
    expect(await errorsFor({ offset: "-1" })).not.toHaveLength(0);
  });

  it("rejects an unknown run status", async () => {
    expect(await errorsFor({ status: "NOT_A_STATUS" })).not.toHaveLength(0);
  });

  it("rejects an empty workflow id", async () => {
    expect(await errorsFor({ workflowId: "" })).not.toHaveLength(0);
  });

  it("rejects unknown query parameters", async () => {
    expect(await errorsFor({ nope: "1" })).not.toHaveLength(0);
  });
});

describe("UpdateSalesTaskDto", () => {
  it("accepts DONE and OPEN", async () => {
    expect(await validate(plainToInstance(UpdateSalesTaskDto, { status: "DONE" }))).toEqual([]);
    expect(await validate(plainToInstance(UpdateSalesTaskDto, { status: "OPEN" }))).toEqual([]);
  });

  it("rejects any other status", async () => {
    expect(await validate(plainToInstance(UpdateSalesTaskDto, { status: "READ" }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(UpdateSalesTaskDto, {}))).not.toHaveLength(0);
  });
});

async function errorsFor(query: Record<string, unknown>) {
  return validate(plainToInstance(WorkflowRunsQueryDto, query), { whitelist: true, forbidNonWhitelisted: true });
}
