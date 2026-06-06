export const kafkaTopics = {
  workflowTriggered: "workflow-triggered",
  workflowStepStarted: "workflow-step-started",
  workflowStepCompleted: "workflow-step-completed",
  workflowStepFailed: "workflow-step-failed",
  agentTaskRequested: "agent-task-requested",
  agentTaskCompleted: "agent-task-completed",
  toolCallRequested: "tool-call-requested",
  toolCallCompleted: "tool-call-completed",
  humanApprovalRequested: "human-approval-requested",
  notificationRequested: "notification-requested",
  workflowCompleted: "workflow-completed",
  workflowFailed: "workflow-failed",
  deadLetterEvents: "dead-letter-events"
} as const;

export type KafkaTopic = (typeof kafkaTopics)[keyof typeof kafkaTopics];

export const consumerGroups = {
  workflowWorker: "agentops.workflow-worker",
  aiWorker: "agentops.ai-worker",
  toolWorker: "agentops.tool-worker",
  notificationWorker: "agentops.notification-worker"
} as const;

