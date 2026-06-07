import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { StatusPill } from "../../components/status-pill";
import { AiConsole } from "../../features/agents/ai-console";
import { fallbackAiUsage, fallbackProviders, safeApiGet, type AiProviders, type AiUsage } from "../../lib/api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

export default async function AgentsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const [providers, usage] = await Promise.all([
    safeApiGet<AiProviders>("/ai/providers", fallbackProviders),
    safeApiGet<AiUsage>("/ai/usage", fallbackAiUsage)
  ]);

  return (
    <AppShell active="agents" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="border-b border-[#d8d0c7] pb-4">
          <p className="text-sm font-semibold uppercase text-[#6b625a]">{t.agents.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-[#171412]">{t.agents.title}</h1>
        </div>

        {providers.source === "fallback" || usage.source === "fallback" ? (
          <div className="rounded-[4px] border border-[#b45309] bg-[#fff7ed] px-3 py-2 text-sm text-[#7c2d12]">
            [!] {t.agents.fallback}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label={t.agents.provider} value={providers.data.defaultProvider} detail={t.agents.providerDetail} />
          <MetricCard label={t.agents.calls} value={usage.data.aiCallsToday} detail={`${usage.data.dailyAiCallLimit} ${t.agents.dailyLimit}`} />
          <MetricCard label={t.agents.tokens} value={usage.data.tokensUsedToday} detail={usage.data.workspaceId} />
        </section>

        <section className="border border-[#ded7cf] bg-white">
          <div className="border-b border-[#ded7cf] px-4 py-3">
            <h2 className="text-base font-bold text-[#171412]">[+] {t.agents.providers}</h2>
          </div>
          <div className="divide-y divide-[#eee7df]">
            {providers.data.providers.map((provider) => (
              <div key={provider.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                <span className="font-medium">{provider.id}</span>
                <span className="text-[#5f5750]">{provider.defaultModel}</span>
                <StatusPill tone={provider.status === "ready" || provider.status === "configured" ? "success" : "warning"}>
                  {provider.status}
                </StatusPill>
              </div>
            ))}
          </div>
        </section>

        <AiConsole labels={t.agents} />
      </div>
    </AppShell>
  );
}
