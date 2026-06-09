import {
  createEvent,
  eventEnvelopeSchema,
  kafkaTopics,
  traceContextFromEvent,
  workflowTriggeredPayloadSchema,
  type EventEnvelope
} from "@agentops/events";
import { validateWorkflowDefinition, type WorkflowDefinition, type WorkflowNode } from "@agentops/shared";

export type WorkflowExecutionPlan = {
  workflowRunId: string;
  startedSteps: EventEnvelope[];
  taskRequests: EventEnvelope[];
  terminalEvents: EventEnvelope[];
  issues: string[];
};

export function handleWorkflowTriggered(rawEvent: unknown): WorkflowExecutionPlan {
  const event = eventEnvelopeSchema.parse(rawEvent);
  const payload = workflowTriggeredPayloadSchema.passthrough().parse(event.payload);

  const definition = event.payload["definition"] as WorkflowDefinition | undefined;
  if (!definition) {
    return failPlan(event, "workflow definition missing from trigger event");
  }

  const validationIssues = validateWorkflowDefinition(definition);
  if (validationIssues.length > 0) {
    return failPlan(event, validationIssues.map((issue) => issue.message).join("; "));
  }

  const startedSteps: EventEnvelope[] = [];
  const taskRequests: EventEnvelope[] = [];
  const terminalEvents: EventEnvelope[] = [];
  const visited = new Set<string>();
  const queue = definition.nodes.filter((node) => node.type === "TRIGGER");

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visited.has(node.id)) {
      continue;
    }
    visited.add(node.id);

    startedSteps.push(
      createEvent({
        type: kafkaTopics.workflowStepStarted,
        workspaceId: event.workspaceId,
        workflowId: event.workflowId,
        workflowRunId: event.workflowRunId,
        ...traceContextFromEvent(event),
        payload: { nodeId: node.id, nodeType: node.type }
      })
    );

    const task = buildTaskRequest(event, node, payload.input);
    if (task) {
      taskRequests.push(task);
    }

    if (node.type === "END") {
      terminalEvents.push(
        createEvent({
          type: kafkaTopics.workflowCompleted,
          workspaceId: event.workspaceId,
          workflowId: event.workflowId,
          workflowRunId: event.workflowRunId,
          ...traceContextFromEvent(event),
          payload: { completedAt: new Date().toISOString() }
        })
      );
      continue;
    }

    const outgoing = definition.edges.filter((edge) => edge.source === node.id);
    for (const edge of outgoing) {
      const target = definition.nodes.find((candidate) => candidate.id === edge.target);
      if (target) {
        queue.push(target);
      }
    }
  }

  return {
    workflowRunId: event.workflowRunId,
    startedSteps,
    taskRequests,
    terminalEvents,
    issues: []
  };
}

function buildTaskRequest(
  event: Pick<EventEnvelope, "eventId" | "workspaceId" | "workflowId" | "workflowRunId" | "requestId" | "traceId">,
  node: WorkflowNode,
  input: Record<string, unknown>
): EventEnvelope | null {
  if (node.type === "AI_AGENT") {
    return createEvent({
      type: kafkaTopics.agentTaskRequested,
      workspaceId: event.workspaceId,
      workflowId: event.workflowId,
      workflowRunId: event.workflowRunId,
      ...traceContextFromEvent(event),
      payload: {
        nodeId: node.id,
        taskId: `aitask_${event.workflowRunId}_${node.id}`,
        input,
        config: node.config
      }
    });
  }

  if (node.type === "WEBHOOK" || node.type === "HTTP_REQUEST" || node.type === "EMAIL_MOCK") {
    return createEvent({
      type: kafkaTopics.toolCallRequested,
      workspaceId: event.workspaceId,
      workflowId: event.workflowId,
      workflowRunId: event.workflowRunId,
      ...traceContextFromEvent(event),
      payload: {
        nodeId: node.id,
        toolCallId: `tool_${event.workflowRunId}_${node.id}`,
        toolType: node.type.toLowerCase(),
        input,
        config: node.config
      }
    });
  }

  return null;
}

function failPlan(event: EventEnvelope, message: string): WorkflowExecutionPlan {
  return {
    workflowRunId: event.workflowRunId,
    startedSteps: [],
    taskRequests: [],
    terminalEvents: [
      createEvent({
        type: kafkaTopics.workflowFailed,
        workspaceId: event.workspaceId,
        workflowId: event.workflowId,
        workflowRunId: event.workflowRunId,
        ...traceContextFromEvent(event),
        payload: { message }
      })
    ],
    issues: [message]
  };
}
