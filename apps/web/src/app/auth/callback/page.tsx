import { Suspense } from "react";
import { AuthCallback } from "../../../features/auth/auth-callback";
import { appCopy, resolveLocale, type LocaleSearchParams } from "../../../lib/i18n";

export default async function AuthCallbackPage({ searchParams }: { searchParams?: LocaleSearchParams }) {
  const locale = await resolveLocale(searchParams);
  return (
    <Suspense fallback={null}>
      <AuthCallback locale={locale} labels={appCopy[locale].auth} />
    </Suspense>
  );
}
