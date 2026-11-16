"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Locale } from "../../lib/i18n";
import { loadAuthUser } from "./auth-client";

export function AuthGate({ children, locale }: { children: ReactNode; locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadAuthUser().then((user) => {
      if (cancelled) {
        return;
      }

      if (!user) {
        const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
        router.replace(`/login?lang=${locale}&next=${encodeURIComponent(current)}`);
        return;
      }

      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [locale, pathname, router, searchParams]);

  if (!isReady) {
    return (
      <div className="grid min-h-[calc(100vh-64px)] place-items-center p-5 text-sm font-semibold text-[var(--mute)]">
        [auth] checking session
      </div>
    );
  }

  return children;
}
