import { z } from "zod";
export declare const workspaceRoleSchema: z.ZodEnum<{
    OWNER: "OWNER";
    ADMIN: "ADMIN";
    MEMBER: "MEMBER";
    VIEWER: "VIEWER";
}>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export declare function hasRoleAtLeast(actual: WorkspaceRole, required: WorkspaceRole): boolean;
export declare function canRunWorkflow(role: WorkspaceRole): boolean;
export declare function canPublishWorkflow(role: WorkspaceRole): boolean;
export declare function canManageWorkspace(role: WorkspaceRole): boolean;
