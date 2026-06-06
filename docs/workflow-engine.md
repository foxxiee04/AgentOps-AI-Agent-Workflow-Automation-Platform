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

## Failure Rules

- Retry failed step execution up to the configured limit.
- Mark the step failed when retry limit is reached.
- Mark the workflow run failed unless the graph defines a valid error path.
- Publish failed events with enough context for dashboard and audit logs.
- Push unprocessable messages to `dead-letter-events`.

