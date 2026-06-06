import { z } from "zod";
export declare const aiProviderSchema: z.ZodEnum<{
    openai: "openai";
    gemini: "gemini";
    mock: "mock";
}>;
export type AiProvider = z.infer<typeof aiProviderSchema>;
export declare const aiAgentNodeConfigSchema: z.ZodObject<{
    modelProvider: z.ZodDefault<z.ZodEnum<{
        openai: "openai";
        gemini: "gemini";
        mock: "mock";
    }>>;
    modelName: z.ZodDefault<z.ZodString>;
    systemPrompt: z.ZodDefault<z.ZodString>;
    userPromptTemplate: z.ZodDefault<z.ZodString>;
    inputMapping: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    outputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    requireHumanApproval: z.ZodDefault<z.ZodBoolean>;
    savePromptAndOutput: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type AiAgentNodeConfig = z.infer<typeof aiAgentNodeConfigSchema>;
export declare const leadScoreResultSchema: z.ZodObject<{
    leadScore: z.ZodNumber;
    category: z.ZodString;
    summary: z.ZodString;
    recommendedAction: z.ZodString;
    personalizedEmail: z.ZodString;
}, z.core.$strip>;
export type LeadScoreResult = z.infer<typeof leadScoreResultSchema>;
export declare function maskSensitivePromptInput(input: unknown): unknown;
