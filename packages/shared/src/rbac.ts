import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

const roleRank: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3
};

export function hasRoleAtLeast(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return roleRank[actual] >= roleRank[required];
}

export function canRunWorkflow(role: WorkspaceRole): boolean {
  return hasRoleAtLeast(role, "MEMBER");
}

export function canPublishWorkflow(role: WorkspaceRole): boolean {
  return hasRoleAtLeast(role, "ADMIN");
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "OWNER";
}

