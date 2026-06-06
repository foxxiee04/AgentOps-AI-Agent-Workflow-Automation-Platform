import { z } from "zod";
export declare const workflowStatusSchema: z.ZodEnum<{
    DRAFT: "DRAFT";
    ACTIVE: "ACTIVE";
    PAUSED: "PAUSED";
    ARCHIVED: "ARCHIVED";
}>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export declare const workflowRunStatusSchema: z.ZodEnum<{
    PENDING: "PENDING";
    RUNNING: "RUNNING";
    WAITING_APPROVAL: "WAITING_APPROVAL";
    COMPLETED: "COMPLETED";
    FAILED: "FAILED";
    CANCELLED: "CANCELLED";
}>;
export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;
export declare const workflowStepStatusSchema: z.ZodEnum<{
    PENDING: "PENDING";
    RUNNING: "RUNNING";
    WAITING_APPROVAL: "WAITING_APPROVAL";
    COMPLETED: "COMPLETED";
    FAILED: "FAILED";
    SKIPPED: "SKIPPED";
}>;
export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>;
export declare const workflowNodeTypeSchema: z.ZodEnum<{
    TRIGGER: "TRIGGER";
    AI_AGENT: "AI_AGENT";
    CONDITION: "CONDITION";
    WEBHOOK: "WEBHOOK";
    HTTP_REQUEST: "HTTP_REQUEST";
    EMAIL_MOCK: "EMAIL_MOCK";
    DELAY: "DELAY";
    HUMAN_APPROVAL: "HUMAN_APPROVAL";
    NOTIFICATION: "NOTIFICATION";
    END: "END";
}>;
export type WorkflowNodeType = z.infer<typeof workflowNodeTypeSchema>;
export declare const workflowNodeSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        TRIGGER: "TRIGGER";
        AI_AGENT: "AI_AGENT";
        CONDITION: "CONDITION";
        WEBHOOK: "WEBHOOK";
        HTTP_REQUEST: "HTTP_REQUEST";
        EMAIL_MOCK: "EMAIL_MOCK";
        DELAY: "DELAY";
        HUMAN_APPROVAL: "HUMAN_APPROVAL";
        NOTIFICATION: "NOTIFICATION";
        END: "END";
    }>;
    name: z.ZodString;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export declare const workflowEdgeSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodString;
    target: z.ZodString;
    condition: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export declare const workflowDefinitionSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            TRIGGER: "TRIGGER";
            AI_AGENT: "AI_AGENT";
            CONDITION: "CONDITION";
            WEBHOOK: "WEBHOOK";
            HTTP_REQUEST: "HTTP_REQUEST";
            EMAIL_MOCK: "EMAIL_MOCK";
            DELAY: "DELAY";
            HUMAN_APPROVAL: "HUMAN_APPROVAL";
            NOTIFICATION: "NOTIFICATION";
            END: "END";
        }>;
        name: z.ZodString;
        config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        target: z.ZodString;
        condition: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowValidationIssue = {
    code: "MISSING_TRIGGER" | "MISSING_END" | "DUPLICATE_NODE_ID" | "EDGE_SOURCE_MISSING" | "EDGE_TARGET_MISSING" | "UNREACHABLE_NODE" | "AI_SCHEMA_MISSING" | "WEBHOOK_URL_MISSING";
    message: string;
    nodeId?: string;
    edgeId?: string;
};
export declare function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationIssue[];
export declare const sampleLeadWorkflowDefinition: WorkflowDefinition;
