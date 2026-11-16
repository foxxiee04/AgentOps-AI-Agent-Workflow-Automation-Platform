"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppCopy, Locale } from "../../lib/i18n";
import { setAuthUser, type AuthUser } from "./auth-client";

export function AuthCallback({ locale, labels }: { locale: Locale; labels: AppCopy["auth"] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const encodedUser = params.get("user");
    const requested = params.get("redirectTo");
    // Only same-site paths: the fragment is attacker-controllable, so never follow an absolute URL.
    const redirectTo =
      requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("://") ? requested : `/dashboard?lang=${locale}`;

    if (!encodedUser) {
      setError(labels.error);
      return;
    }

    try {
      const user = JSON.parse(decodeBase64Url(encodedUser)) as AuthUser;
      setAuthUser(user);
      router.replace(redirectTo);
    } catch {
      setError(labels.error);
    }
  }, [labels.error, locale, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-4 text-[var(--ink)]">
      <section className="w-full max-w-lg rounded-xl border border-[var(--hairline)] bg-white">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h1 className="text-base font-bold text-[var(--ink-deep)]">{labels.callbackTitle}</h1>
        </div>
        <div className="space-y-3 p-4 text-sm text-[var(--body)]">
          <p>{labels.callbackBody}</p>
          {error ? <p className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger-ink)]">⚠ {error}</p> : null}
        </div>
      </section>
    </main>
  );
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return window.decodeURIComponent(
    window
      .atob(padded)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}
