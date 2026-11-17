import { z } from "zod";

export const adminProviderSchema = z.enum(["password", "google"]);
export const adminRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

export const adminOverviewTotalsSchema = z.object({
  users: z.number(),
  newUsers: z.number(),
  activeUsers7d: z.number(),
  disabledUsers: z.number(),
  platformAdmins: z.number(),
  workspaces: z.number(),
  workflows: z.number(),
  activeWorkflows: z.number(),
  runs: z.number(),
  runsCompleted: z.number(),
  runsFailed: z.number(),
  runsActive: z.number(),
  successRate: z.number(),
  approvalsApproved: z.number(),
  approvalsRejected: z.number(),
  approvalsPending: z.number(),
  aiCalls: z.number(),
  aiTokens: z.number(),
  leadsHigh: z.number(),
  leadsLow: z.number(),
  leadsSpam: z.number(),
  salesTasksOpen: z.number(),
  salesTasksDone: z.number()
});

export const adminOverviewSeriesPointSchema = z.object({
  date: z.string(),
  signups: z.number(),
  runs: z.number(),
  runsFailed: z.number(),
  aiTokens: z.number(),
  approvals: z.number()
});

export const adminOverviewSchema = z.object({
  generatedAt: z.string(),
  range: z.object({
    from: z.string(),
    to: z.string(),
    days: z.number()
  }),
  totals: adminOverviewTotalsSchema,
  series: z.array(adminOverviewSeriesPointSchema),
  topWorkspaces: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      runs: z.number(),
      members: z.number(),
      aiTokens: z.number()
    })
  ).max(5),
  signupsByProvider: z.array(
    z.object({
      provider: adminProviderSchema,
      users: z.number()
    })
  )
});

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  provider: adminProviderSchema,
  isPlatformAdmin: z.boolean(),
  disabled: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  workspaces: z.number()
});

export const adminMembershipSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  role: adminRoleSchema,
  joinedAt: z.string()
});

export const adminUserDetailSchema = adminUserSchema.extend({
  memberships: z.array(adminMembershipSchema)
});

export const adminUsersPageSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
});

export const adminWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  ownerEmail: z.string(),
  members: z.number(),
  workflows: z.number(),
  runs: z.number(),
  aiTokens: z.number(),
  createdAt: z.string()
});

export const adminWorkspacesPageSchema = z.object({
  items: z.array(adminWorkspaceSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
});

export const adminAuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  workspaceName: z.string().nullable(),
  metadata: z.unknown(),
  createdAt: z.string()
});

export const adminAuditPageSchema = z.object({
  items: z.array(adminAuditEntrySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
});

export const adminUserPatchSchema = z.object({
  disabled: z.boolean().optional(),
  isPlatformAdmin: z.boolean().optional()
});

export type AdminProvider = z.infer<typeof adminProviderSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type AdminOverviewTotals = z.infer<typeof adminOverviewTotalsSchema>;
export type AdminOverviewSeriesPoint = z.infer<typeof adminOverviewSeriesPointSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminMembership = z.infer<typeof adminMembershipSchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminUsersPage = z.infer<typeof adminUsersPageSchema>;
export type AdminWorkspace = z.infer<typeof adminWorkspaceSchema>;
export type AdminWorkspacesPage = z.infer<typeof adminWorkspacesPageSchema>;
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;
export type AdminAuditPage = z.infer<typeof adminAuditPageSchema>;
export type AdminUserPatch = z.infer<typeof adminUserPatchSchema>;
