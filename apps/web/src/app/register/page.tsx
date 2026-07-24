import { Suspense } from "react";
import { AuthForm } from "../../features/auth/auth-form";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

export default async function RegisterPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <Suspense fallback={null}>
        <AuthForm mode="register" locale={locale} labels={appCopy[locale].auth} />
      </Suspense>
    </main>
  );
}
