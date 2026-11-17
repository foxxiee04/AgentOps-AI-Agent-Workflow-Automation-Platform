import { AppShell } from "../../components/app-shell";
import { EmptyState } from "../../components/data-state";
import { ApprovalsHeading } from "../../features/approvals/approvals-heading";
import { ApprovalQueue } from "../../features/approvals/approval-queue";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";
import { getActiveWorkspace } from "../../lib/workspace";

export default async function ApprovalsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const { active } = await getActiveWorkspace();

  if (!active) {
    return (
      <AppShell active="approvals" locale={locale}>
        <div className="space-y-6 p-5">
          <div className="border-b border-[var(--hairline)] pb-4">
            <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.approvals.eyebrow}</p>
            <ApprovalsHeading>{t.approvals.title}</ApprovalsHeading>
            <p className="mt-1 text-sm text-[var(--body)]">{t.approvals.intro}</p>
          </div>
          <EmptyState title={t.states.emptyTitle} body={t.shell.noWorkspacesMessage} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="approvals" locale={locale}>
      <div className="space-y-6 p-5">
        <div className="border-b border-[var(--hairline)] pb-4">
          <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.approvals.eyebrow}</p>
          <ApprovalsHeading>{t.approvals.title}</ApprovalsHeading>
          <p className="mt-1 text-sm text-[var(--body)]">{t.approvals.intro}</p>
        </div>
        <ApprovalQueue labels={t.approvals} states={t.states} locale={locale} workspaceId={active.id} />
      </div>
    </AppShell>
  );
}
