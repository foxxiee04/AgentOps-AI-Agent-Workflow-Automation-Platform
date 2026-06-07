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
- personalizedEmail
- confidence
```

## Example Output

```json
{
  "leadScore": 87,
  "category": "high-intent",
  "summary": "The lead is interested in automating sales and support workflows.",
  "recommendedAction": "Send a personalized follow-up email and create a sales task.",
  "personalizedEmail": "Hi Anna, thanks for reaching out...",
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

## Safety Rules

- Validate AI output against the configured schema.
- Retry invalid JSON only within the configured retry limit.
- Store token usage and model metadata.
- Do not trust AI decisions without validation.
- Do not include secrets, env values, private keys, or unnecessary PII in prompts.
- Allow privacy settings to disable prompt/output storage.
- Enforce daily AI call and token quotas by workspace.
- Do real provider calls in the AI worker path, not in request/response HTTP handlers.
