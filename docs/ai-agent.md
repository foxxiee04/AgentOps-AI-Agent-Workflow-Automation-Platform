# AI Agent Integration

AI is a workflow node, not a standalone chatbot. Every AI node must receive structured input and produce validated structured output.

## AI Node Config

```txt
modelProvider
modelName
systemPrompt
userPromptTemplate
inputMapping
outputSchema
temperature
maxTokens
retryLimit
requireHumanApproval
savePromptAndOutput
```

## Platform Layer

The AI platform layer includes:

- prompt template rendering with `{{variable}}` placeholders
- input mapping from workflow payload paths into prompt variables
- masking for emails, phone numbers, and secret-like keys
- JSON Schema output validation
- deterministic mock provider for local testing
- OpenAI Responses provider path in the AI worker
- prompt evaluation test cases before workflow publishing

## Example Prompt

```txt
You are a sales operations assistant.
Analyze the lead and return JSON with:
- leadScore from 0 to 100
- category
- summary
- recommendedAction
- confidence
```

## Example Output

```json
{
  "leadScore": 87,
  "category": "high-intent",
  "summary": "The lead is interested in automating sales and support workflows.",
  "recommendedAction": "Send a personalized follow-up email and create a sales task.",
  "confidence": 0.91
}
```

## API Testing Endpoints

```txt
GET  /ai/providers
POST /ai/test-agent
POST /ai/evaluate-agent
GET  /ai/tasks/:id
GET  /ai/usage
```

`/ai/test-agent` previews the rendered prompt, safe input, JSON Schema validation result, and token estimate. `/ai/evaluate-agent` runs multiple deterministic test cases and returns pass rate plus mismatches.

The `/agents` frontend page reads `/ai/providers` and `/ai/usage`, then posts to `/ai/test-agent` through a small browser console. Keep this UI as a testing surface for prompt/config experiments until persisted agent configuration screens are implemented.

## Lead Scoring Setup

- Scoring output: `leadScore` (0-100), `category` (`high-intent` | `low-intent` | `spam`), `summary`, `recommendedAction`, `confidence`. The email step is a second AI node returning `subject` and `body`.
- Prompts live in `packages/shared/src/ai.ts` (`leadScoringSystemPrompt`, `leadScoringUserPromptTemplate`, `leadEmail*`) and use `{{name}}`, `{{company}}`, `{{email}}`, `{{message}}`, `{{source}}`.
- Providers: `mock` (default, deterministic, no network) or `openai` (Responses API with strict JSON Schema, called only from `ai-worker`). To switch, set `OPENAI_API_KEY` and set `modelProvider: "openai"`, `modelName: "gpt-4o-mini"` on the node; use a stronger `modelName` on the email node if writing quality needs it.
- Retry: output that is not valid JSON or fails the schema is retried up to `retryLimit` extra times (token usage is summed); after that the step fails and the result is not used.
- Privacy: email addresses become `an***@domain`, phone numbers become `[PHONE_REDACTED]`, secret-like keys become `[REDACTED]` before the prompt is built.
- Quotas: `AI_DAILY_CALL_LIMIT` (default 100) and `AI_DAILY_TOKEN_LIMIT` (default 200000) per day; `/ai/test-agent` and `/ai/evaluate-agent` return HTTP 429 when exceeded and `/ai/usage` reports both limits.
- Evaluation: `POST /ai/evaluate-agent` with an empty body runs the labeled dataset (`leadEvaluationCases`, 24 leads) and returns `passRate` plus mismatches. Run it after every prompt change and compare the pass rate.

## Safety Rules

- Validate AI output against the configured schema.
- Retry invalid JSON only within the configured retry limit.
- Store token usage and model metadata.
- Do not trust AI decisions without validation.
- Do not include secrets, env values, private keys, or unnecessary PII in prompts.
- Allow privacy settings to disable prompt/output storage.
- Enforce daily AI call and token quotas by workspace.
- Do real provider calls in the AI worker path, not in request/response HTTP handlers.
