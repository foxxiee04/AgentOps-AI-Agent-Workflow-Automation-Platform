# Workflow Engine

The workflow engine executes a published workflow version as a graph of configured nodes.

## Node Types

```txt
Trigger Node
AI Agent Node
Condition Node
HTTP Request Node
Email Mock Node
Webhook Node
Delay Node
Human Approval Node
Notification Node
End Node
```

## MVP Nodes

- Manual Trigger
- AI Agent
- Condition
- Webhook Mock
- End

## Publish Validation

Before publishing, validate that:

- The graph has at least one trigger node.
- The graph has at least one end node.
- Node IDs are unique.
- Edges reference existing nodes.
- Required node configs are valid.
- No infinite cycle can execute without a stop condition.
- All paths from triggers can reach an end node or explicit terminal failure.

## Execution Flow

```txt
User clicks Run Workflow
-> API creates workflow_run
-> API publishes workflow-triggered
-> Workflow Worker loads immutable workflow version
-> Workflow Worker executes graph step by step
-> AI/tool nodes publish task-requested events
-> Specialized workers complete tasks
-> Workflow Worker continues execution
-> Run completes, fails, waits for approval, or is cancelled
```

## Lead Qualification Flow

The seeded `Lead qualification` workflow (`sampleLeadWorkflowDefinition`) runs the full lead pipeline:

```txt
TRIGGER (lead from webhook/form)
-> AI_AGENT "Score lead"        -> leadScore, category, summary, recommendedAction, confidence
-> CONDITION "High intent?"
   -> leadScore > 80   -> AI_AGENT "Write personalized email" -> subject, body
                       -> HUMAN_APPROVAL -> EMAIL_MOCK -> NOTIFICATION "Call lead back within 24 hours" -> END
   -> else (<= 80)     -> END
```

How the worker executes it:

- `handleWorkflowTriggered` walks the graph from the trigger and **pauses** at every AI/tool node after publishing its task request. The request carries the immutable `definition` and the accumulated `context`.
- When `agent-task-completed` or `tool-call-completed` arrives, `handleStepCompleted` merges the node output into the context (AI output is also flattened so `leadScore` is directly addressable) and continues with the next nodes.
- Edge conditions use `<path> <op> <literal>` with `> >= < <= == !=` (for example `leadScore > 80`, `category == spam`). A score of exactly 80 takes the `else` branch. An `else` edge fires only when no sibling condition matched.
- `HUMAN_APPROVAL` publishes `human-approval-requested`, stores a `HumanApproval` row (masked lead, assessment and drafted email) and puts the run in `WAITING_APPROVAL`. A reviewer decides through `POST /workflow-runs/:id/steps/:stepId/approval`; the API publishes `human-approval-decided` and the worker continues (approve) or the run ends as `CANCELLED` (reject).
- `WORKFLOW_AUTO_APPROVE=true` skips approval nodes, but only when `APP_ENV=local`. The default is `false`, and every other environment always waits for a reviewer.
- `NOTIFICATION` publishes `notification-requested` (the sales task) and continues.
- The workflow-worker owns run state: it writes step status, masked step input, outputs, AI results (model, tokens), tool results, approvals and the internal run context in one transaction before publishing the next events.

## Delivery Guarantees

Every worker runs through `startKafkaWorker` / `processMessage` (`packages/events/src/consumer.ts`):

- Idempotency key `workflowRunId:nodeId:eventType`, stored per consumer group in `ProcessedMessage` (unique index). A redelivered message is skipped.
- A failing handler is retried up to 3 attempts (200 ms, 400 ms backoff). `NonRetryableError` (invalid AI output after `retryLimit`, quota exceeded, missing API key) skips the retries.
- After the last attempt the message goes to `dead-letter-events` with the error and original event, and `workflow-step-failed` is published for the node so the run ends as `FAILED` instead of hanging.
- Offsets are committed after the handler, the publish and the idempotency record finished.

## Failure Rules

- Retry failed step execution up to the configured limit.
- Mark the step failed when retry limit is reached.
- Mark the workflow run failed unless the graph defines a valid error path.
- Publish failed events with enough context for dashboard and audit logs.
- Push unprocessable messages to `dead-letter-events`.

