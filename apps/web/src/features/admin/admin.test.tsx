import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appCopy } from "../../lib/i18n";
import { AdminDenied } from "./admin-ui";
import { adminReportHref } from "./api";
import { AdminReportCard } from "./report-card";
import { optimisticUserPatch, runUserPatch } from "./accounts-table";
import {
  adminAuditPageSchema,
  adminOverviewSchema,
  adminUserDetailSchema,
  adminUsersPageSchema,
  adminWorkspacesPageSchema,
  type AdminUser
} from "./schemas";

const en = appCopy.en.admin;

const user: AdminUser = {
  id: "usr_1",
  email: "anna@agentops.dev",
  name: "Anna Nguyen",
  provider: "password",
  isPlatformAdmin: false,
  disabled: false,
  createdAt: "2026-01-04T09:00:00.000Z",
  lastLoginAt: "2026-11-01T08:30:00.000Z",
  workspaces: 2
};

const overviewFixture = {
  generatedAt: "2026-11-18T00:00:00.000Z",
  range: { from: "2026-10-20", to: "2026-11-18", days: 30 },
  totals: {
    users: 42,
    newUsers: 7,
    activeUsers7d: 18,
    disabledUsers: 2,
    platformAdmins: 1,
    workspaces: 5,
    workflows: 12,
    activeWorkflows: 9,
    runs: 340,
    runsCompleted: 300,
    runsFailed: 25,
    runsActive: 15,
    successRate: 0.882,
    approvalsApproved: 120,
    approvalsRejected: 18,
    approvalsPending: 6,
    aiCalls: 510,
    aiTokens: 92000,
    leadsHigh: 44,
    leadsLow: 21,
    leadsSpam: 4,
    salesTasksOpen: 8,
    salesTasksDone: 31
  },
  series: [
    { date: "2026-11-17", signups: 2, runs: 12, runsFailed: 1, aiTokens: 3200, approvals: 4 },
    { date: "2026-11-18", signups: 1, runs: 9, runsFailed: 0, aiTokens: 2800, approvals: 3 }
  ],
  topWorkspaces: [{ id: "ws_1", name: "Acme", runs: 120, members: 6, aiTokens: 32000 }],
  signupsByProvider: [
    { provider: "password", users: 30 },
    { provider: "google", users: 12 }
  ]
};

describe("admin schemas", () => {
  it("parses the overview contract, series and provider breakdown", () => {
    const parsed = adminOverviewSchema.parse(overviewFixture);

    expect(parsed.totals.successRate).toBeCloseTo(0.882);
    expect(parsed.series).toHaveLength(2);
    expect(parsed.series[0]).toMatchObject({ date: "2026-11-17", runsFailed: 1 });
    expect(parsed.signupsByProvider[1]).toEqual({ provider: "google", users: 12 });
  });

  it("rejects an overview without totals", () => {
    const { totals: _totals, ...broken } = overviewFixture;
    expect(() => adminOverviewSchema.parse(broken)).toThrow();
  });

  it("parses paged users, user detail, workspaces and audit entries", () => {
    expect(
      adminUsersPageSchema.parse({ items: [user], total: 1, page: 1, pageSize: 20 }).items[0].email
    ).toBe("anna@agentops.dev");

    const detail = adminUserDetailSchema.parse({
      ...user,
      memberships: [
        { workspaceId: "ws_1", workspaceName: "Acme", role: "OWNER", joinedAt: "2026-02-01T00:00:00.000Z" }
      ]
    });
    expect(detail.memberships[0].role).toBe("OWNER");

    const workspaces = adminWorkspacesPageSchema.parse({
      items: [
        {
          id: "ws_1",
          name: "Acme",
          slug: "acme",
          ownerEmail: "anna@agentops.dev",
          members: 6,
          workflows: 4,
          runs: 120,
          aiTokens: 32000,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
    expect(workspaces.items[0].slug).toBe("acme");

    const audit = adminAuditPageSchema.parse({
      items: [
        {
          id: "aud_1",
          action: "admin.user.disabled",
          entityType: "user",
          entityId: null,
          actorEmail: "root@agentops.dev",
          workspaceName: null,
          metadata: { reason: "abuse" },
          createdAt: "2026-11-18T00:00:00.000Z"
        }
      ],
      total: 1,
      page: 1,
      pageSize: 30
    });
    expect(audit.items[0].metadata).toEqual({ reason: "abuse" });
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      adminUsersPageSchema.parse({ items: [{ ...user, provider: "saml" }], total: 1, page: 1, pageSize: 20 })
    ).toThrow();
  });
});

describe("accounts table optimistic update", () => {
  it("patches the row immediately", () => {
    const optimistic = optimisticUserPatch([user], user.id, { disabled: true });
    expect(optimistic[0].disabled).toBe(true);
    expect(user.disabled).toBe(false);
  });

  it("returns the original snapshot so the caller can roll back after a failed request", async () => {
    const snapshot = [user];
    const result = await runUserPatch(snapshot, user.id, { disabled: true }, async () => {
      throw new Error("403 forbidden");
    });

    expect(result.items).toBe(snapshot);
    expect(result.items[0].disabled).toBe(false);
    expect(result.error).toBe("403 forbidden");
  });

  it("keeps the server row on success", async () => {
    const calls: Array<{ id: string; patch: unknown }> = [];
    const result = await runUserPatch([user], user.id, { isPlatformAdmin: true }, async (id, patch) => {
      calls.push({ id, patch });
      return { ...user, ...patch };
    });

    expect(calls).toEqual([{ id: user.id, patch: { isPlatformAdmin: true } }]);
    expect(result.updated?.isPlatformAdmin).toBe(true);
    expect(result.items[0].isPlatformAdmin).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe("admin no-permission state", () => {
  it("renders the data-state component with the localized message", () => {
    const html = renderToStaticMarkup(<AdminDenied labels={en} />);
    expect(html).toContain(en.noPermissionTitle);
    expect(html).toContain(en.noPermissionBody);
  });
});

describe("CSV report links", () => {
  it("builds the report URL without a double slash", () => {
    expect(adminReportHref("users", 30, "https://api.agentops.dev/")).toBe(
      "https://api.agentops.dev/admin/reports/users.csv?days=30"
    );
  });

  it("renders four download anchors with the selected range", () => {
    const html = renderToStaticMarkup(<AdminReportCard days={7} labels={en} locale="en" />);

    expect(html.match(/download=""/g)?.length).toBe(4);
    for (const type of ["users", "workspaces", "runs", "usage"]) {
      expect(html).toContain(`/admin/reports/${type}.csv?days=7`);
    }
    expect(html).toContain(en.overview.exportUsers);
    expect(html).toContain(en.overview.exportUsage);
  });
});
