import { AppShell } from "../../components/app-shell";
import { StatusPill } from "../../components/status-pill";
import { apiUrl, fallbackHealth, safeApiGet, type HealthReady } from "../../lib/api";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

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

export default async function SettingsPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  const t = appCopy[locale];
  const health = await safeApiGet<HealthReady>("/health/ready", fallbackHealth);
  const dependencyRows = Object.entries(health.data.details ?? health.data.info ?? health.data.error ?? {
    api: { status: health.data.status }
  });

  return (
    <AppShell active="settings" locale={locale}>
      <div className="space-y-8 p-5">
        <div className="border-b border-[#d8d0c7] pb-4">
          <p className="text-sm font-semibold uppercase text-[#6b625a]">{t.settings.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-[#171412]">{t.settings.title}</h1>
        </div>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="border border-[#ded7cf] bg-white">
            <div className="border-b border-[#ded7cf] px-4 py-3">
              <h2 className="text-base font-bold text-[#171412]">[+] {t.settings.apiBoundary}</h2>
            </div>
            <div className="divide-y divide-[#eee7df] text-sm">
              <div className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]">
                <span className="text-[#5f5750]">{t.settings.baseUrl}</span>
                <span className="break-all font-medium">{apiUrl}</span>
              </div>
              <div className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]">
                <span className="text-[#5f5750]">{t.settings.dataSource}</span>
                <StatusPill tone={health.source === "api" ? "success" : "warning"}>{health.source}</StatusPill>
              </div>
              <div className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]">
                <span className="text-[#5f5750]">{t.settings.security}</span>
                <span>Helmet, CORS, validation pipe, throttling, request ID, request logging, exception filter</span>
              </div>
            </div>
          </div>

          <div className="border border-[#ded7cf] bg-white">
            <div className="border-b border-[#ded7cf] px-4 py-3">
              <h2 className="text-base font-bold text-[#171412]">[+] {t.settings.dependencies}</h2>
            </div>
            <div className="divide-y divide-[#eee7df]">
              {dependencyRows.map(([name, dependency]) => (
                <div key={name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span>{name}</span>
                  <StatusPill tone={dependency.status === "up" ? "success" : "danger"}>{dependency.status}</StatusPill>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-[#ded7cf] bg-white">
          <div className="border-b border-[#ded7cf] px-4 py-3">
            <h2 className="text-base font-bold text-[#171412]">[+] {t.settings.runtime}</h2>
          </div>
          <div className="divide-y divide-[#eee7df] text-sm">
            {runtimeRows[locale].map(([label, value]) => (
              <div key={label} className="grid gap-2 px-4 py-3 md:grid-cols-[220px_1fr]">
                <span className="text-[#5f5750]">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
