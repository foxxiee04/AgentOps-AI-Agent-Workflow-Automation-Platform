// Deterministic heuristics used by the mock provider (ai-worker) and the API test endpoints.
import { detectPromptInjection } from "./ai";

const spamPattern = /viagra|crypto giveaway|click here|casino|free money|backlinks|\bseo\b|\d+% profit|guaranteed returns|cheap pills|prescription|promotional|act now|asdf|asdkj|(.)\1{3,}|[!=$]{4,}/i;
const lowIntentPattern =
  /just looking|looking around|curious|maybe|someday|not sure|window shopping|explore|tim hieu|tìm hiểu|tham khao|tham khảo|chua co|chưa có|free plan|later|not urgent|at some point|partner|reseller|similar product|we sell/i;
const intentPattern = /automat|chat|order|crm|tự động|tu dong|đơn hàng|don hang|trả lời khách|workflow|\bapi\b|migration|enterprise/i;
const priceQuestionPattern = /giá|price|bao nhiêu|cost/i;

export function buildMockLeadScore(safeInput: unknown): Record<string, unknown> {
  const text = JSON.stringify(safeInput ?? "");
  const message = String((safeInput as Record<string, unknown> | undefined)?.["message"] ?? text);
  const injectionText = [
    ...Object.values((safeInput as Record<string, unknown> | undefined) ?? {}).filter(
      (value): value is string => typeof value === "string"
    ),
    message
  ].join("\n");
  const shortWithoutIntent = message.trim().length < 10 && !priceQuestionPattern.test(message);

  if (detectPromptInjection(injectionText) || spamPattern.test(text) || shortWithoutIntent) {
    return {
      leadScore: 5,
      category: "spam",
      summary: "The message looks like spam or has no meaningful content.",
      recommendedAction: "Discard the lead.",
      confidence: 0.9
    };
  }

  if (!lowIntentPattern.test(message) && (intentPattern.test(message) || /urgent|sales/i.test(message))) {
    return {
      leadScore: 87,
      category: "high-intent",
      summary: "The lead is interested in workflow automation and AI-supported operations.",
      recommendedAction: "Send a personalized email and create a sales follow-up task.",
      confidence: 0.91
    };
  }

  return {
    leadScore: 45,
    category: "low-intent",
    summary: "The lead shows general interest without a concrete need.",
    recommendedAction: "Keep the lead on file for nurturing.",
    confidence: 0.7
  };
}

export function buildMockLeadEmail(variables: Record<string, unknown>): Record<string, unknown> {
  const name = String(variables["name"] ?? "there");
  const company = String(variables["company"] ?? "your team");
  return {
    subject: `Automating workflows at ${company}`,
    body: `Hi ${name}, thanks for reaching out. AgentOps can help ${company} qualify leads and automate follow-ups. Could we schedule a short call this week?`
  };
}
