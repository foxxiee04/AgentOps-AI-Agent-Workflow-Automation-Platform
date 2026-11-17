import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { DataNotice, ErrorState } from "../../components/data-state";
import { StatusPill } from "../../components/status-pill";
import { AiConsole, StaggerList } from "../../features/agents/ai-console";
import { fallbackAiUsage, fallbackProviders, type AiProviders, type AiUsage } from "../../lib/api";
import { safeApiGet } from "../../lib/server-api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

export default async function AgentsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const [providers, usage] = await Promise.all([
    safeApiGet<AiProviders>("/ai/providers", fallbackProviders),
    safeApiGet<AiUsage>("/ai/usage", fallbackAiUsage)
  ]);
  const failed = [providers, usage].find((resource) => resource.source === "error");

  return (
    <AppShell active="agents" locale={locale}>
      <div className="space-y-8 p-5 lg:p-8">
        <header className="page-header">
          <div className="min-w-0">
            <p className="mono-label">{t.agents.eyebrow}</p>
            <h1 className="mt-1 font-display text-[34px] font-medium leading-tight text-[var(--ink)]">{t.agents.title}</h1>
          </div>
        </header>

        <DataNotice resource={{ source: providers.source === "fallback" || usage.source === "fallback" ? "fallback" : "api" }} labels={t.states} />

        {failed ? (
          <ErrorState labels={t.states} detail={failed.error} />
        ) : (
        <>
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label={t.agents.provider} value={providers.data.defaultProvider} detail={t.agents.providerDetail} />
          <MetricCard label={t.agents.calls} value={usage.data.aiCallsToday} detail={`${usage.data.dailyAiCallLimit} ${t.agents.dailyLimit}`} />
          <MetricCard label={t.agents.tokens} value={usage.data.tokensUsedToday} detail={usage.data.workspaceId} />
        </section>

        <section className="card lumen-card-lift">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <h2 className="text-base font-semibold text-[var(--ink)]">{t.agents.providers}</h2>
          </div>
          <StaggerList className="divide-y divide-[var(--hairline)]">
            {providers.data.providers.map((provider) => (
              <div key={provider.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                <span className="font-medium text-[var(--ink)]">{provider.id}</span>
                <span className="text-[var(--mute)]">{provider.defaultModel}</span>
                <StatusPill tone={provider.status === "ready" || provider.status === "configured" ? "success" : "warning"}>
                  {provider.status}
                </StatusPill>
              </div>
            ))}
          </StaggerList>
        </section>
        </>
        )}

        <AiConsole labels={t.agents} />
      </div>
    </AppShell>
  );
}
