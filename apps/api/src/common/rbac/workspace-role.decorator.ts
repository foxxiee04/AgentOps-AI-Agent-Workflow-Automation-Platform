import { SetMetadata } from "@nestjs/common";
import type { WorkspaceRole } from "@agentops/shared";

export const WORKSPACE_ROLES_KEY = "workspaceRoles";
export const WorkspaceRoles = (...roles: WorkspaceRole[]) => SetMetadata(WORKSPACE_ROLES_KEY, roles);

export type WorkspaceScopeSource = "workspaceParam" | "workflowParamOrBody" | "runParam" | "workspaceQuery";
export const WORKSPACE_SCOPE_KEY = "workspaceScope";

/**
 * Tells the guard how to resolve the workspace a request belongs to:
 * - `workspaceParam`: `request.params.id` is the workspace id.
 * - `workflowParamOrBody`: `request.params.id` is a workflow id (its workspaceId is looked up);
 *   when there is no `:id`, `request.body.workspaceId` is used.
 * - `runParam`: `request.params.id` is a workflow run id (its workspaceId is looked up).
 * - `workspaceQuery`: `request.query.workspaceId` is the workspace id (400 when missing).
 */
export const WorkspaceScope = (source: WorkspaceScopeSource) => SetMetadata(WORKSPACE_SCOPE_KEY, source);
