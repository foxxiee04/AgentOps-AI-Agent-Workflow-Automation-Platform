"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleLeadWorkflowDefinition = exports.workflowDefinitionSchema = exports.workflowEdgeSchema = exports.workflowNodeSchema = exports.workflowNodeTypeSchema = exports.workflowStepStatusSchema = exports.workflowRunStatusSchema = exports.workflowStatusSchema = void 0;
exports.validateWorkflowDefinition = validateWorkflowDefinition;
const zod_1 = require("zod");
exports.workflowStatusSchema = zod_1.z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
exports.workflowRunStatusSchema = zod_1.z.enum([
    "PENDING",
    "RUNNING",
    "WAITING_APPROVAL",
    "COMPLETED",
    "FAILED",
    "CANCELLED"
]);
exports.workflowStepStatusSchema = zod_1.z.enum([
    "PENDING",
    "RUNNING",
    "WAITING_APPROVAL",
    "COMPLETED",
    "FAILED",
    "SKIPPED"
]);
exports.workflowNodeTypeSchema = zod_1.z.enum([
    "TRIGGER",
    "AI_AGENT",
    "CONDITION",
    "WEBHOOK",
    "HTTP_REQUEST",
    "EMAIL_MOCK",
    "DELAY",
    "HUMAN_APPROVAL",
    "NOTIFICATION",
    "END"
]);
exports.workflowNodeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    type: exports.workflowNodeTypeSchema,
    name: zod_1.z.string().min(1),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({})
});
exports.workflowEdgeSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    source: zod_1.z.string().min(1),
    target: zod_1.z.string().min(1),
    condition: zod_1.z.string().optional()
});
exports.workflowDefinitionSchema = zod_1.z.object({
    nodes: zod_1.z.array(exports.workflowNodeSchema),
    edges: zod_1.z.array(exports.workflowEdgeSchema)
});
function validateWorkflowDefinition(definition) {
    const issues = [];
    const nodeIds = new Set();
    const duplicateIds = new Set();
    for (const node of definition.nodes) {
        if (nodeIds.has(node.id)) {
            duplicateIds.add(node.id);
        }
        nodeIds.add(node.id);
        if (node.type === "AI_AGENT" && !node.config.outputSchema) {
            issues.push({
                code: "AI_SCHEMA_MISSING",
                message: "AI Agent nodes must define an output schema.",
                nodeId: node.id
            });
        }
        if (node.type === "WEBHOOK" && !node.config.url) {
            issues.push({
                code: "WEBHOOK_URL_MISSING",
                message: "Webhook nodes must define a URL.",
                nodeId: node.id
            });
        }
    }
    for (const id of duplicateIds) {
        issues.push({
            code: "DUPLICATE_NODE_ID",
            message: `Node id '${id}' is duplicated.`,
            nodeId: id
        });
    }
    if (!definition.nodes.some((node) => node.type === "TRIGGER")) {
        issues.push({ code: "MISSING_TRIGGER", message: "Workflow must include at least one trigger node." });
    }
    if (!definition.nodes.some((node) => node.type === "END")) {
        issues.push({ code: "MISSING_END", message: "Workflow must include at least one end node." });
    }
    for (const edge of definition.edges) {
        if (!nodeIds.has(edge.source)) {
            issues.push({
                code: "EDGE_SOURCE_MISSING",
                message: `Edge '${edge.id}' references a missing source node.`,
                edgeId: edge.id
            });
        }
        if (!nodeIds.has(edge.target)) {
            issues.push({
                code: "EDGE_TARGET_MISSING",
                message: `Edge '${edge.id}' references a missing target node.`,
                edgeId: edge.id
            });
        }
    }
    const triggerIds = definition.nodes.filter((node) => node.type === "TRIGGER").map((node) => node.id);
    const reachable = new Set(triggerIds);
    const queue = [...triggerIds];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }
        for (const edge of definition.edges.filter((candidate) => candidate.source === current)) {
            if (!reachable.has(edge.target)) {
                reachable.add(edge.target);
                queue.push(edge.target);
            }
        }
    }
    for (const node of definition.nodes) {
        if (!reachable.has(node.id)) {
            issues.push({
                code: "UNREACHABLE_NODE",
                message: `Node '${node.name}' is not reachable from a trigger.`,
                nodeId: node.id
            });
        }
    }
    return issues;
}
exports.sampleLeadWorkflowDefinition = {
    nodes: [
        { id: "trigger-1", type: "TRIGGER", name: "Manual lead trigger", config: { triggerType: "manual" } },
        {
            id: "ai-1",
            type: "AI_AGENT",
            name: "Score lead",
            config: {
                modelProvider: "openai",
                outputSchema: {
                    type: "object",
                    required: ["leadScore", "summary", "recommendedAction"],
                    properties: {
                        leadScore: { type: "number" },
                        summary: { type: "string" },
                        recommendedAction: { type: "string" }
                    }
                }
            }
        },
        { id: "condition-1", type: "CONDITION", name: "High intent?", config: { expression: "leadScore > 80" } },
        { id: "webhook-1", type: "WEBHOOK", name: "Send follow-up mock", config: { url: "https://example.com/mock" } },
        { id: "end-1", type: "END", name: "Done", config: {} }
    ],
    edges: [
        { id: "edge-1", source: "trigger-1", target: "ai-1" },
        { id: "edge-2", source: "ai-1", target: "condition-1" },
        { id: "edge-3", source: "condition-1", target: "webhook-1", condition: "true" },
        { id: "edge-4", source: "webhook-1", target: "end-1" }
    ]
};
//# sourceMappingURL=workflow.js.map