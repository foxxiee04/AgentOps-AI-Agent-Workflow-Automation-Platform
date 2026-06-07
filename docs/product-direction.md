# Product Direction Notes

These notes capture outside product signals that should guide the next AgentOps iterations.

## Signals From Current Automation Tools

- Run history is an operational primitive. Zapier's Zap history surfaces run status, filters, step-level status, limited received/sent data, replay context, and retention limits. AgentOps should keep `/runs` and `/runs/:id` first-class, then add filters, replay failed runs, retention/export policy, and step payload inspection.
- Human review belongs inside the graph, not only after a run. n8n documents human approval before an AI Agent executes selected high-risk tools, with approve/deny outcomes and channel-specific approval routing. AgentOps already has `HUMAN_APPROVAL` in the shared node enum; the next builder iteration should expose it as a configurable node with reviewer channel, timeout, approval payload, and denied-path behavior.
- AI observability needs structured traces. OpenTelemetry GenAI semantic conventions now define events, exceptions, metrics, model spans, and agent/framework spans. AgentOps should align future worker telemetry with OTel naming instead of inventing a private schema.
- Agent debugging should show the decision path. LangSmith positions traces as step-by-step records of prompts, tool calls, model interactions, and decision points. AgentOps run detail should evolve from node status to execution trace: inputs, redacted prompts, tool arguments, model/provider metadata, token usage, latency, and validation errors.

## Near-Term Product Backlog

1. Add run filters on `/runs`: status, workflow, trigger type, date range, and search by run id/event id.
2. Add run replay for failed or cancelled runs, guarded by immutable workflow version rules.
3. Add `HUMAN_APPROVAL` builder support and backend DTO validation.
4. Add step detail drawers with redacted input/output, retry count, timings, and error messages.
5. Add telemetry fields that map cleanly to OpenTelemetry GenAI spans and events.

## References

- Zapier Help: https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history
- n8n Docs: https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/
- OpenTelemetry GenAI semantic conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- LangChain LangSmith observability: https://docs.langchain.com/oss/python/langchain/observability
