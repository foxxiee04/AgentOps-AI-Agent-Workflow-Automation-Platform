"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceRoleSchema = void 0;
exports.hasRoleAtLeast = hasRoleAtLeast;
exports.canRunWorkflow = canRunWorkflow;
exports.canPublishWorkflow = canPublishWorkflow;
exports.canManageWorkspace = canManageWorkspace;
const zod_1 = require("zod");
exports.workspaceRoleSchema = zod_1.z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
const roleRank = {
    VIEWER: 0,
    MEMBER: 1,
    ADMIN: 2,
    OWNER: 3
};
function hasRoleAtLeast(actual, required) {
    return roleRank[actual] >= roleRank[required];
}
function canRunWorkflow(role) {
    return hasRoleAtLeast(role, "MEMBER");
}
function canPublishWorkflow(role) {
    return hasRoleAtLeast(role, "ADMIN");
}
function canManageWorkspace(role) {
    return role === "OWNER";
}
//# sourceMappingURL=rbac.js.map