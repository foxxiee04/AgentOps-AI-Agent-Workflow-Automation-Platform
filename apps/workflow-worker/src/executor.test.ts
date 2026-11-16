import { describe, expect, it } from "vitest";
import { createEvent, kafkaTopics, type EventEnvelope } from "@agentops/events";
import { sampleLeadWorkflowDefinition, type WorkflowDefinition } from "@agentops/shared";
import { handleWorkflowEvent, resolveAutoApprove } from "./executor";

const base = { workspaceId: "ws_demo", workflowId: "wf_demo", workflowRunId: "run_demo" };
const lead = { name: "Anna", company: "Shop ABC", email: "anna@shopabc.vn", message: "We need chat automation." };

/** A workflow stored before the `rejected` edge existed: rejecting cancels the run. */
const definitionWithoutRejectedEdge: WorkflowDefinition = {
  ...sampleLeadWorkflowDefinition,
  edges: sampleLeadWorkflowDefinition.edges.filter((edge) => edge.condition !== "rejected")
};

function trigger(definition: WorkflowDefinition = sampleLeadWorkflowDefinition) {
  return createEvent({
    type: kafkaTopics.workflowTriggered,
    ...base,
    payload: { input: lead, triggerType: "webhook", workflowVersionId: "wfv_demo", definition }
  });
}

function completion(type: EventEnvelope["type"], request: EventEnvelope, output: Record<string, unknown>) {
  return createEvent({
    type,
    ...base,
    payload: {
      nodeId: request.payload["nodeId"],
      output,
      definition: request.payload["definition"],
      context: request.payload["context"]
    }
  });
}

function decision(
  nodeId: string,
  decisionValue: "approve" | "reject",
  context: Record<string, unknown>,
  options: {
    comment?: string;
    editedEmail?: { subject: string; body: string };
    definition?: WorkflowDefinition;
  } = {}
) {
  return createEvent({
    type: kafkaTopics.humanApprovalDecided,
    ...base,
    payload: {
      nodeId,
      decision: decisionValue,
      comment: options.comment,
      decidedBy: "user_1",
      definition: options.definition ?? sampleLeadWorkflowDefinition,
      context,
      ...(options.editedEmail ? { editedEmail: options.editedEmail } : {})
    }
  });
}

/** Runs trigger -> score -> email draft and returns the plan produced after the draft completed. */
function runUntilApproval(score: number, autoApprove = false, definition: WorkflowDefinition = sampleLeadWorkflowDefinition) {
  const scoring = handleWorkflowEvent(trigger(definition), { autoApprove }).taskRequests[0]!;
  const afterScore = handleWorkflowEvent(
    completion(kafkaTopics.agentTaskCompleted, scoring, { leadScore: score, category: "high-intent" }),
    { autoApprove }
  );
  const emailAi = afterScore.taskRequests[0]!;
  return handleWorkflowEvent(completion(kafkaTopics.agentTaskCompleted, emailAi, { subject: "Hi Anna", body: "Hello" }), { autoApprove });
}

describe("lead workflow execution", () => {
  it("pauses at the scoring AI node and masks the stored step input", () => {
    const plan = handleWorkflowEvent(trigger());

    expect(plan.issues).toEqual([]);
    expect(plan.taskRequests.map((task) => [task.type, task.payload["nodeId"]])).toEqual([[kafkaTopics.agentTaskRequested, "ai-1"]]);
    const started = plan.startedSteps.find((step) => step.payload["nodeId"] === "ai-1");
    expect(started?.payload["input"]).toMatchObject({ email: "an***@shopabc.vn" });
    // The AI worker still receives the real context; masking happens when the prompt is built.
    expect(plan.taskRequests[0]?.payload["context"]).toMatchObject({ email: "anna@shopabc.vn" });
  });

  it("routes a hot lead (score 87) to the email draft and waits for a reviewer", () => {
    const plan = runUntilApproval(87);

    expect(plan.taskRequests.map((task) => task.type)).toEqual([kafkaTopics.humanApprovalRequested]);
    expect(plan.taskRequests[0]?.payload["review"]).toMatchObject({
      email: { subject: "Hi Anna", body: "Hello" },
      lead: { email: "an***@shopabc.vn" },
      assessment: { leadScore: 87 }
    });
    expect(plan.startedSteps.at(-1)?.payload).toMatchObject({ nodeId: "approval-1", status: "WAITING_APPROVAL" });
    expect(plan.terminalEvents).toEqual([]);
  });

  it("continues to the mock email after approval and finishes with a sales task", () => {
    const waiting = runUntilApproval(87);
    const approved = handleWorkflowEvent(decision("approval-1", "approve", waiting.context));

    expect(approved.taskRequests.map((task) => task.type)).toEqual([kafkaTopics.toolCallRequested]);
    const emailTool = approved.taskRequests[0]!;
    const afterSend = handleWorkflowEvent(completion(kafkaTopics.toolCallCompleted, emailTool, { delivered: true }));

    expect(afterSend.taskRequests.map((task) => task.type)).toEqual([kafkaTopics.notificationRequested]);
    expect(afterSend.taskRequests[0]?.payload).toMatchObject({
      kind: "SALES_TASK",
      title: "Call lead back within 24 hours",
      dueInHours: 24
    });
    expect(afterSend.terminalEvents.map((event) => event.type)).toEqual([kafkaTopics.workflowCompleted]);
  });

  it("keeps the hot lead when the reviewer rejects: the email is skipped, the sales task is created", () => {
    const waiting = runUntilApproval(87);
    const rejected = handleWorkflowEvent(decision("approval-1", "reject", waiting.context, { comment: "wrong tone" }));

    expect(rejected.terminalEvents.map((event) => event.type)).toEqual([kafkaTopics.workflowCompleted]);
    expect(rejected.taskRequests.map((task) => [task.type, task.payload["nodeId"]])).toEqual([
      [kafkaTopics.notificationRequested, "notify-1"]
    ]);
    expect(rejected.taskRequests[0]?.payload).toMatchObject({
      kind: "SALES_TASK",
      title: "Call lead back within 24 hours",
      body: "Email rejected by reviewer: wrong tone. Anna — Shop ABC (score 87)"
    });
    // The email node is never started: it stays pending and is skipped with the run.
    expect(rejected.startedSteps.some((step) => step.payload["nodeId"] === "email-1")).toBe(false);
  });

  it("cancels the run when the reviewer rejects and the workflow has no rejected edge", () => {
    const waiting = runUntilApproval(87, false, definitionWithoutRejectedEdge);
    const rejected = handleWorkflowEvent(
      decision("approval-1", "reject", waiting.context, { comment: "wrong tone", definition: definitionWithoutRejectedEdge })
    );

    expect(rejected.taskRequests).toEqual([]);
    expect(rejected.terminalEvents[0]).toMatchObject({ type: kafkaTopics.workflowFailed, payload: { status: "CANCELLED" } });
  });

  it("sends the email the reviewer edited instead of the drafted one", () => {
    const waiting = runUntilApproval(87);
    const approved = handleWorkflowEvent(
      decision("approval-1", "approve", waiting.context, { editedEmail: { subject: "Edited subject", body: "Edited body" } })
    );

    const emailTool = approved.taskRequests[0]!;
    expect(emailTool.type).toBe(kafkaTopics.toolCallRequested);
    expect(emailTool.payload["nodeId"]).toBe("email-1");
    expect(emailTool.payload["input"]).toMatchObject({ subject: "Edited subject", body: "Edited body" });
    // The lead's own address is not overwritten by the edited email.
    expect(emailTool.payload["input"]).toMatchObject({ email: "anna@shopabc.vn" });
  });

  it("never follows the rejected edge when the reviewer approves", () => {
    const waiting = runUntilApproval(87);
    const approved = handleWorkflowEvent(decision("approval-1", "approve", waiting.context));

    expect(approved.taskRequests.map((task) => task.payload["nodeId"])).toEqual(["email-1"]);
    expect(approved.taskRequests.some((task) => task.payload["nodeId"] === "notify-1")).toBe(false);
  });

  it("skips the approval only when auto-approve is enabled", () => {
    const plan = runUntilApproval(87, true);
    expect(plan.taskRequests.map((task) => task.type)).toEqual([kafkaTopics.toolCallRequested]);
  });

  it.each([40, 80])("ends without email when score is %i", (score) => {
    const scoring = handleWorkflowEvent(trigger()).taskRequests[0]!;
    const plan = handleWorkflowEvent(completion(kafkaTopics.agentTaskCompleted, scoring, { leadScore: score }));

    expect(plan.taskRequests).toEqual([]);
    expect(plan.terminalEvents.map((event) => event.type)).toEqual([kafkaTopics.workflowCompleted]);
    const condition = plan.startedSteps.find(
      (step) => step.type === kafkaTopics.workflowStepCompleted && step.payload["nodeId"] === "condition-1"
    );
    expect(condition?.payload["output"]).toEqual({ branch: ["end-1"] });
  });

  it("fails the run when a worker dead-letters a step", () => {
    const failed = createEvent({ type: kafkaTopics.workflowStepFailed, ...base, payload: { nodeId: "ai-1", message: "provider down" } });
    const plan = handleWorkflowEvent(failed);

    expect(plan.terminalEvents[0]).toMatchObject({ type: kafkaTopics.workflowFailed, payload: { status: "FAILED" } });
    expect(plan.issues[0]).toContain("provider down");
  });
});

describe("resolveAutoApprove", () => {
  it("defaults to false and is honoured only in the local environment", () => {
    expect(resolveAutoApprove({})).toBe(false);
    expect(resolveAutoApprove({ WORKFLOW_AUTO_APPROVE: "true" })).toBe(true);
    expect(resolveAutoApprove({ WORKFLOW_AUTO_APPROVE: "true", APP_ENV: "local" })).toBe(true);
    expect(resolveAutoApprove({ WORKFLOW_AUTO_APPROVE: "true", APP_ENV: "dev" })).toBe(false);
    expect(resolveAutoApprove({ WORKFLOW_AUTO_APPROVE: "true", APP_ENV: "production" })).toBe(false);
  });
});

describe("self-emitted failures", () => {
  it("ignores workflow-step-failed events produced by the workflow-worker itself", () => {
    const own = createEvent({
      type: kafkaTopics.workflowStepFailed,
      ...base,
      payload: { nodeId: "approval-1", message: "Rejected by reviewer", origin: "workflow-worker" }
    });
    const plan = handleWorkflowEvent(own);
    expect(plan.terminalEvents).toEqual([]);
  });
});
