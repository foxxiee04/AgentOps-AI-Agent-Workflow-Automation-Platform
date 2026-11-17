import { AppShell } from "../../components/app-shell";
import { DataNotice, EmptyState, ErrorState } from "../../components/data-state";
import { StatusPill, type StatusPillTone } from "../../components/status-pill";
import { FlashStatus, StaggerList } from "../../features/agents/ai-console";
import {
  apiUrl,
  fallbackHealth,
  fallbackReadiness,
  safeHealthGet,
  type DashboardReadiness,
  type HealthReady,
  type ReadinessStatus
} from "../../lib/api";
import { safeApiGet } from "../../lib/server-api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";
import { getActiveWorkspace } from "../../lib/workspace";

const runtimeRows = {
  vi: [
    ["Backend shape", "NestJS modular monolith"],
    ["Async domains", "workflow-worker, ai-worker, tool-worker, notification-worker"],
    ["Event broker", "Kafka topics từ packages/events"],
    ["Database", "PostgreSQL qua Prisma"],
    ["Cache/status", "Redis"],
    ["Cloud target", "AWS EKS + ECR + Terraform"]
  ],
  en: [
    ["Backend shape", "NestJS modular monolith"],
    ["Async domains", "workflow-worker, ai-worker, tool-worker, notification-worker"],
    ["Event broker", "Kafka topics from packages/events"],
    ["Database", "PostgreSQL via Prisma"],
    ["Cache/status", "Redis"],
    ["Cloud target", "AWS EKS + ECR + Terraform"]
  ]
};

const readinessTone: Record<ReadinessStatus, StatusPillTone> = {
  ready: "success",
  warning: "warning",
  blocked: "danger",
  planned: "info"
};

export default async function SettingsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const { active } = await getActiveWorkspace();

  if (!active) {
    return (
      <AppShell active="settings" locale={locale}>
        <div className="space-y-8 p-5">
          <div className="border-b border-[var(--hairline)] pb-4">
            <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.settings.eyebrow}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-[var(--ink-deep)]">{t.settings.title}</h1>
          </div>
          <EmptyState title={t.states.emptyTitle} body={t.shell.noWorkspacesMessage} />
        </div>
      </AppShell>
    );
  }

  const [health, readiness] = await Promise.all([
    safeHealthGet<HealthReady>("/health/ready", fallbackHealth),
    safeApiGet<DashboardReadiness>(`/dashboard/readiness?workspaceId=${encodeURIComponent(active.id)}`, fallbackReadiness)
  ]);
  const dependencyRows =
    health.source === "error"
      ? [["api", { status: "down" }] as const]
      : Object.entries(health.data.details ?? health.data.info ?? health.data.error ?? { api: { status: health.data.status } });

  return (
    <AppShell active="settings" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="border-b border-[var(--hairline)] pb-4">
          <p className="text-sm font-semibold uppercase text-[var(--mute)]">{t.settings.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-[var(--ink-deep)]">{t.settings.title}</h1>
        </div>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--hairline)] bg-white">
            <div className="border-b border-[var(--hairline)] px-4 py-3">
              <h2 className="text-base font-bold text-[var(--ink-deep)]">{t.settings.apiBoundary}</h2>
            </div>
            <div className="divide-y divide-[var(--hairline)] text-sm">
              <div className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]">
                <span className="text-[var(--mute)]">{t.settings.baseUrl}</span>
                <span className="break-all font-medium">{apiUrl}</span>
              </div>
              <div className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]">
                <span className="text-[var(--mute)]">{t.settings.dataSource}</span>
                <StatusPill tone={health.source === "api" ? "success" : health.source === "error" ? "danger" : "warning"}>{health.source}</StatusPill>
              </div>
              <div className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]">
                <span className="text-[var(--mute)]">{t.settings.security}</span>
                <span>Helmet, CORS, validation pipe, throttling, request ID, request logging, exception filter</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--hairline)] bg-white">
            <div className="border-b border-[var(--hairline)] px-4 py-3">
              <h2 className="text-base font-bold text-[var(--ink-deep)]">{t.settings.dependencies}</h2>
            </div>
            <div className="divide-y divide-[var(--hairline)]">
              {dependencyRows.map(([name, dependency]) => (
                <div key={name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span>{name}</span>
                  <FlashStatus status={dependency.status}>
                    <StatusPill tone={dependency.status === "up" ? "success" : "danger"}>{dependency.status}</StatusPill>
                  </FlashStatus>
                </div>
              ))}
            </div>
          </div>
        </section>

        <DataNotice resource={readiness} labels={t.states} />
        {readiness.source === "error" ? (
          <ErrorState labels={t.states} detail={readiness.error} />
        ) : (
        <section className="rounded-xl border border-[var(--hairline)] bg-white">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[var(--ink-deep)]">{t.settings.readiness}</h2>
              <div className="flex flex-wrap gap-2">
                {(["ready", "warning", "blocked", "planned"] as const).map((status) => (
                  <FlashStatus key={status} status={status}>
                    <StatusPill tone={readinessTone[status]}>
                      {status}: {readiness.data.summary[status]}
                    </StatusPill>
                  </FlashStatus>
                ))}
              </div>
            </div>
          </div>
          <StaggerList className="divide-y divide-[var(--hairline)] text-sm">
            {readiness.data.items.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[190px_110px_1fr]">
                <span className="font-medium text-[var(--ink-deep)]">{item.label}</span>
                <FlashStatus status={item.status}>
                  <StatusPill tone={readinessTone[item.status]}>{item.status}</StatusPill>
                </FlashStatus>
                <div>
                  <p className="text-[var(--body)]">{item.summary}</p>
                  <p className="mt-1 text-[var(--mute)]">{item.action}</p>
                </div>
              </div>
            ))}
          </StaggerList>
        </section>
        )}

        <section className="rounded-xl border border-[var(--hairline)] bg-white">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <h2 className="text-base font-bold text-[var(--ink-deep)]">{t.settings.runtime}</h2>
          </div>
          <div className="divide-y divide-[var(--hairline)] text-sm">
            {runtimeRows[locale].map(([label, value]) => (
              <div key={label} className="grid gap-2 px-4 py-3 md:grid-cols-[220px_1fr]">
                <span className="text-[var(--mute)]">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
