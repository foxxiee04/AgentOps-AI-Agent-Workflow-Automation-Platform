import {
  createEvent,
  eventEnvelopeSchema,
  humanApprovalDecidedPayloadSchema,
  kafkaTopics,
  stepCompletedPayloadSchema,
  traceContextFromEvent,
  workflowStepFailedPayloadSchema,
  workflowTriggeredPayloadSchema,
  type EventEnvelope
} from "@agentops/events";
import {
  editedEmailSchema,
  maskSensitivePromptInput,
  selectOutgoingEdges,
  selectRejectedEdges,
  validateWorkflowDefinition,
  type EditedEmail,
  type WorkflowDefinition,
  type WorkflowNode
} from "@agentops/shared";

export type WorkflowExecutionPlan = {
  workflowRunId: string;
  /** step started/completed events, in execution order */
  startedSteps: EventEnvelope[];
  /** work for other workers: agent/tool/notification/approval requests */
  taskRequests: EventEnvelope[];
  /** workflow-completed or workflow-failed */
  terminalEvents: EventEnvelope[];
  /** accumulated run context after this step (trigger input + node outputs) */
  context: Record<string, unknown>;
  issues: string[];
};

export type ExecutorOptions = {
  /** Skip HUMAN_APPROVAL nodes. Only honoured for local development, see `resolveAutoApprove`. */
  autoApprove?: boolean;
};

const workerOrigin = "workflow-worker";

const taskNodeTypes = new Set<WorkflowNode["type"]>(["AI_AGENT", "WEBHOOK", "HTTP_REQUEST", "EMAIL_MOCK"]);

/** `WORKFLOW_AUTO_APPROVE=true` works only when `APP_ENV` is `local`; every other environment waits for a reviewer. */
export function resolveAutoApprove(env: Record<string, string | undefined> = process.env): boolean {
  return env["WORKFLOW_AUTO_APPROVE"] === "true" && (env["APP_ENV"] ?? "local") === "local";
}

/** Routes any event the workflow-worker consumes to the matching handler. */
export function handleWorkflowEvent(rawEvent: unknown, options: ExecutorOptions = {}): WorkflowExecutionPlan {
  const event = eventEnvelopeSchema.parse(rawEvent);
  switch (event.type) {
    case kafkaTopics.workflowTriggered:
      return handleWorkflowTriggered(event, options);
    case kafkaTopics.agentTaskCompleted:
    case kafkaTopics.toolCallCompleted:
      return handleStepCompleted(event, options);
    case kafkaTopics.humanApprovalDecided:
      return handleApprovalDecided(event, options);
    case kafkaTopics.workflowStepFailed:
      return handleStepFailed(event);
    default:
      return emptyPlan(event, {});
  }
}

export function handleWorkflowTriggered(rawEvent: unknown, options: ExecutorOptions = {}): WorkflowExecutionPlan {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = workflowTriggeredPayloadSchema.passthrough().parse(event.payload);

  const definition = event.payload["definition"] as WorkflowDefinition | undefined;
  if (!definition) {
    return failPlan(event, "workflow definition missing from trigger event", payload.input);
  }

  const validationIssues = validateWorkflowDefinition(definition);
  if (validationIssues.length > 0) {
    return failPlan(event, validationIssues.map((issue) => issue.message).join("; "), payload.input);
  }

  return advance(
    event,
    definition,
    definition.nodes.filter((node) => node.type === "TRIGGER"),
    payload.input,
    options
  );
}

/**
 * Continues a run after an AI or tool node completed: merges the output into the context,
 * evaluates outgoing conditions and starts the next nodes.
 */
export function handleStepCompleted(rawEvent: unknown, options: ExecutorOptions = {}): WorkflowExecutionPlan {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = stepCompletedPayloadSchema.parse(event.payload);

  if (!payload.definition) {
    return failPlan(event, "workflow definition missing from completion event", payload.context);
  }
  if (!payload.definition.nodes.some((node) => node.id === payload.nodeId)) {
    return failPlan(event, `Node '${payload.nodeId}' not found in workflow definition`, payload.context);
  }

  const context: Record<string, unknown> = { ...payload.context, [payload.nodeId]: payload.output };
  // Only AI output is flattened into the shared context so branch conditions can read `leadScore` directly.
  if (event.type === kafkaTopics.agentTaskCompleted) {
    Object.assign(context, payload.output);
  }

  const completed = stepEvent(event, kafkaTopics.workflowStepCompleted, { nodeId: payload.nodeId, output: payload.output });
  const plan = advance(event, payload.definition, nextNodes(payload.definition, payload.nodeId, context), context, options);
  plan.startedSteps.unshift(completed);
  return plan;
}

/** Resumes (approve) or ends (reject) a run waiting at a HUMAN_APPROVAL node. */
export function handleApprovalDecided(rawEvent: unknown, options: ExecutorOptions = {}): WorkflowExecutionPlan {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = humanApprovalDecidedPayloadSchema.parse(event.payload);
  const output = { decision: payload.decision, decidedBy: payload.decidedBy, comment: payload.comment };

  if (payload.decision === "reject") {
    return handleRejection(event, payload, output, options);
  }

  // An approved email may carry the reviewer's edits: they replace the drafted text.
  const editedEmail = readEditedEmail(event.payload["editedEmail"]);
  const context: Record<string, unknown> = {
    ...payload.context,
    [payload.nodeId]: output,
    approvalDecision: "approved",
    ...(editedEmail ? { editedEmail, subject: editedEmail.subject, body: editedEmail.body } : {})
  };
  const completed = stepEvent(event, kafkaTopics.workflowStepCompleted, { nodeId: payload.nodeId, output });
  const next = nextNodes(payload.definition, payload.nodeId, context);
  if (next.length === 0) {
    // The approval node has no path for an approved decision (e.g. only a `rejected` edge).
    const plan = emptyPlan(event, context);
    plan.startedSteps.push(completed);
    plan.terminalEvents.push(
      createEvent({ ...eventBase(event), type: kafkaTopics.workflowCompleted, payload: { completedAt: new Date().toISOString() } })
    );
    return plan;
  }
  const plan = advance(event, payload.definition, next, context, options);
  plan.startedSteps.unshift(completed);
  return plan;
}

/**
 * A rejected approval either cancels the run (no `rejected` edge in the graph) or continues it
 * through the `rejected` edges, so a hot lead still gets its sales task.
 */
function handleRejection(
  event: EventEnvelope,
  payload: { nodeId: string; comment?: string; definition: WorkflowDefinition; context: Record<string, unknown> },
  output: Record<string, unknown>,
  options: ExecutorOptions
): WorkflowExecutionPlan {
  const rejectedEdges = selectRejectedEdges(payload.definition.edges.filter((edge) => edge.source === payload.nodeId));
  if (rejectedEdges.length === 0) {
    const plan = failPlan(event, `Rejected by reviewer at '${payload.nodeId}'`, payload.context, "CANCELLED");
    plan.startedSteps.push(
      stepEvent(event, kafkaTopics.workflowStepFailed, { nodeId: payload.nodeId, message: "Rejected by reviewer", output, origin: workerOrigin })
    );
    return plan;
  }

  const context: Record<string, unknown> = {
    ...payload.context,
    [payload.nodeId]: output,
    approvalDecision: "rejected",
    reviewerComment: payload.comment ?? ""
  };
  const completed = stepEvent(event, kafkaTopics.workflowStepCompleted, { nodeId: payload.nodeId, output });
  const next = rejectedEdges
    .map((edge) => payload.definition.nodes.find((node) => node.id === edge.target))
    .filter((node): node is WorkflowNode => Boolean(node));
  const plan = advance(event, payload.definition, next, context, options);
  plan.startedSteps.unshift(completed);
  return plan;
}

/** A worker gave up on a node (dead-lettered); the run fails with that node's error. */
export function handleStepFailed(rawEvent: unknown): WorkflowExecutionPlan {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = workflowStepFailedPayloadSchema.parse(event.payload);
  // Failures this worker already turned into a terminal event (e.g. a rejection) need no second pass.
  if (event.payload["origin"] === workerOrigin) {
    return emptyPlan(event, {});
  }
  return failPlan(event, `Step '${payload.nodeId}' failed: ${payload.message}`, {});
}

function nextNodes(definition: WorkflowDefinition, nodeId: string, context: Record<string, unknown>) {
  const outgoing = definition.edges.filter((edge) => edge.source === nodeId);
  return selectOutgoingEdges(outgoing, context)
    .map((edge) => definition.nodes.find((candidate) => candidate.id === edge.target))
    .filter((node): node is WorkflowNode => Boolean(node));
}

function advance(
  event: EventEnvelope,
  definition: WorkflowDefinition,
  startNodes: WorkflowNode[],
  context: Record<string, unknown>,
  options: ExecutorOptions
): WorkflowExecutionPlan {
  const plan = emptyPlan(event, context);
  const visited = new Set<string>();
  const queue = [...startNodes];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node.id)) {
      continue;
    }
    visited.add(node.id);

    // Task nodes pause the run; the completion event resumes it.
    if (taskNodeTypes.has(node.type)) {
      plan.startedSteps.push(
        stepEvent(event, kafkaTopics.workflowStepStarted, {
          nodeId: node.id,
          nodeType: node.type,
          input: maskSensitivePromptInput(context)
        })
      );
      plan.taskRequests.push(buildTaskRequest(event, node, context, definition));
      continue;
    }

    if (node.type === "HUMAN_APPROVAL" && !options.autoApprove) {
      plan.startedSteps.push(
        stepEvent(event, kafkaTopics.workflowStepStarted, { nodeId: node.id, nodeType: node.type, status: "WAITING_APPROVAL" })
      );
      plan.taskRequests.push(
        createEvent({
          ...eventBase(event),
          type: kafkaTopics.humanApprovalRequested,
          payload: { nodeId: node.id, title: node.name, review: buildReview(context) }
        })
      );
      continue;
    }

    // Inline nodes run inside the worker and complete immediately.
    plan.startedSteps.push(stepEvent(event, kafkaTopics.workflowStepStarted, { nodeId: node.id, nodeType: node.type }));
    const next = nextNodes(definition, node.id, context);
    plan.startedSteps.push(
      stepEvent(event, kafkaTopics.workflowStepCompleted, { nodeId: node.id, output: inlineOutput(node, next, options) })
    );

    if (node.type === "NOTIFICATION") {
      plan.taskRequests.push(
        createEvent({
          ...eventBase(event),
          type: kafkaTopics.notificationRequested,
          payload: {
            nodeId: node.id,
            kind: String(node.config["kind"] ?? "SALES_TASK"),
            title: String(node.config["title"] ?? node.name),
            body: notificationBody(context),
            dueInHours: Number(node.config["dueInHours"] ?? 24)
          }
        })
      );
    }

    if (node.type === "END") {
      plan.terminalEvents.push(
        createEvent({ ...eventBase(event), type: kafkaTopics.workflowCompleted, payload: { completedAt: new Date().toISOString() } })
      );
      continue;
    }

    queue.push(...next);
  }

  return plan;
}

function inlineOutput(node: WorkflowNode, next: WorkflowNode[], options: ExecutorOptions): Record<string, unknown> {
  switch (node.type) {
    case "CONDITION":
      return { branch: next.map((candidate) => candidate.id) };
    case "HUMAN_APPROVAL":
      return { decision: "approve", decidedBy: "auto-approve", autoApproved: Boolean(options.autoApprove) };
    case "NOTIFICATION":
      return { requested: true };
    default:
      return {};
  }
}

/** What the reviewer sees: the drafted email and the lead assessment, with PII masked. */
function buildReview(context: Record<string, unknown>): Record<string, unknown> {
  return maskSensitivePromptInput({
    lead: { name: context["name"], company: context["company"], email: context["email"], source: context["source"] },
    assessment: {
      leadScore: context["leadScore"],
      category: context["category"],
      summary: context["summary"],
      recommendedAction: context["recommendedAction"]
    },
    email: { subject: context["subject"], body: context["body"] }
  }) as Record<string, unknown>;
}

/** The sales task body. A rejected email states the reason, the lead still has to be called back. */
function notificationBody(context: Record<string, unknown>) {
  const who = [context["name"], context["company"]].filter(Boolean).join(" — ");
  const score = context["leadScore"] !== undefined ? ` (score ${String(context["leadScore"])})` : "";
  const body = `${who || "New lead"}${score}`;
  if (context["approvalDecision"] !== "rejected") {
    return body;
  }
  const reason = String(context["reviewerComment"] ?? "").trim();
  return `${reason ? `Email rejected by reviewer: ${reason}.` : "Email rejected by reviewer."} ${body}`;
}

function buildTaskRequest(
  event: EventEnvelope,
  node: WorkflowNode,
  context: Record<string, unknown>,
  definition: WorkflowDefinition
): EventEnvelope {
  if (node.type === "AI_AGENT") {
    return createEvent({
      ...eventBase(event),
      type: kafkaTopics.agentTaskRequested,
      payload: {
        nodeId: node.id,
        taskId: `aitask_${event.workflowRunId}_${node.id}`,
        input: context,
        config: node.config,
        definition,
        context
      }
    });
  }

  return createEvent({
    ...eventBase(event),
    type: kafkaTopics.toolCallRequested,
    payload: {
      nodeId: node.id,
      toolCallId: `tool_${event.workflowRunId}_${node.id}`,
      toolType: node.type.toLowerCase(),
      input: node.type === "EMAIL_MOCK" ? emailMockInput(context) : context,
      config: node.config,
      definition,
      context
    }
  });
}

/** The mock email sends the text the reviewer approved, not the drafted one. */
function emailMockInput(context: Record<string, unknown>) {
  const edited = readEditedEmail(context["editedEmail"]);
  if (!edited) {
    return context;
  }
  return { ...context, subject: edited.subject, body: edited.body };
}

/** Reads the reviewer's edited email; anything unexpected is ignored. */
function readEditedEmail(value: unknown): EditedEmail | undefined {
  const parsed = editedEmailSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function eventBase(event: EventEnvelope) {
  return {
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    workflowRunId: event.workflowRunId,
    ...traceContextFromEvent(event)
  };
}

function stepEvent(
  event: EventEnvelope,
  type: typeof kafkaTopics.workflowStepStarted | typeof kafkaTopics.workflowStepCompleted | typeof kafkaTopics.workflowStepFailed,
  payload: Record<string, unknown>
) {
  return createEvent({ ...eventBase(event), type, payload });
}

function emptyPlan(event: EventEnvelope, context: Record<string, unknown>): WorkflowExecutionPlan {
  return { workflowRunId: event.workflowRunId, startedSteps: [], taskRequests: [], terminalEvents: [], context, issues: [] };
}

function failPlan(
  event: EventEnvelope,
  message: string,
  context: Record<string, unknown>,
  status: "FAILED" | "CANCELLED" = "FAILED"
): WorkflowExecutionPlan {
  const plan = emptyPlan(event, context);
  plan.terminalEvents.push(createEvent({ ...eventBase(event), type: kafkaTopics.workflowFailed, payload: { message, status } }));
  plan.issues.push(message);
  return plan;
}
