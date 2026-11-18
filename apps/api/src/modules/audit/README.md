# Audit Module

Stores sensitive user and system actions for traceability, and exposes workspace-scoped audit logs for workspace administrators.

## Endpoints

- `GET /audit-logs?workspaceId=&page=&pageSize=&action=`:
  - Scoped to workspace via `workspaceQuery` parameter and guarded by `WorkspaceRoleGuard`.
  - Requires `ADMIN` role (`@WorkspaceRoles("ADMIN")`, `@WorkspaceScope("workspaceQuery")`).
  - Returns paged audit log records for that workspace (newest first) including actor email, workspace name, action, entity type/id, and metadata.
