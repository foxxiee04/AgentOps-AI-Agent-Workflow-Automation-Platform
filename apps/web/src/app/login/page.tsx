import { Suspense } from "react";
import { AuthForm } from "../../features/auth/auth-form";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#1c1917]">
      <Suspense fallback={null}>
        <AuthForm mode="login" locale={locale} labels={appCopy[locale].auth} />
      </Suspense>
    </main>
  );
}
