"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadScoreResultSchema = exports.aiAgentNodeConfigSchema = exports.aiProviderSchema = void 0;
exports.maskSensitivePromptInput = maskSensitivePromptInput;
const zod_1 = require("zod");
exports.aiProviderSchema = zod_1.z.enum(["openai", "gemini", "mock"]);
exports.aiAgentNodeConfigSchema = zod_1.z.object({
    modelProvider: exports.aiProviderSchema.default("mock"),
    modelName: zod_1.z.string().default("mock-lead-scorer"),
    systemPrompt: zod_1.z.string().min(1).default("You are an operations assistant."),
    userPromptTemplate: zod_1.z.string().min(1).default("Analyze this input and return structured JSON."),
    inputMapping: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
    outputSchema: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    temperature: zod_1.z.number().min(0).max(2).default(0.2),
    maxTokens: zod_1.z.number().int().positive().max(8000).default(1000),
    requireHumanApproval: zod_1.z.boolean().default(false),
    savePromptAndOutput: zod_1.z.boolean().default(false)
});
exports.leadScoreResultSchema = zod_1.z.object({
    leadScore: zod_1.z.number().min(0).max(100),
    category: zod_1.z.string().min(1),
    summary: zod_1.z.string().min(1),
    recommendedAction: zod_1.z.string().min(1),
    personalizedEmail: zod_1.z.string().min(1)
});
function maskSensitivePromptInput(input) {
    if (!input || typeof input !== "object") {
        return input;
    }
    return JSON.parse(JSON.stringify(input).replace(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi, (_match, name, domain) => `${name.slice(0, 2)}***@${domain}`));
}
//# sourceMappingURL=ai.js.map