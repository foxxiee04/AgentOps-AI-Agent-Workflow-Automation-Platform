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
requireHumanApproval
savePromptAndOutput
```

## Example Prompt

```txt
You are a sales operations assistant.
Analyze the lead and return JSON with:
- leadScore from 0 to 100
- category
- summary
- recommendedAction
- personalizedEmail
```

## Example Output

```json
{
  "leadScore": 87,
  "category": "high-intent",
  "summary": "The lead is interested in automating sales and support workflows.",
  "recommendedAction": "Send a personalized follow-up email and create a sales task.",
  "personalizedEmail": "Hi Anna, thanks for reaching out..."
}
```

## Safety Rules

- Validate AI output against the configured schema.
- Retry invalid JSON only within the configured retry limit.
- Store token usage and model metadata.
- Do not trust AI decisions without validation.
- Do not include secrets, env values, private keys, or unnecessary PII in prompts.
- Allow privacy settings to disable prompt/output storage.
- Enforce daily AI call and token quotas by workspace.

