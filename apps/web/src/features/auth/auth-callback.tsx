"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppCopy, Locale } from "../../lib/i18n";
import { saveAuthSession, type AuthUser } from "./auth-client";

export function AuthCallback({ locale, labels }: { locale: Locale; labels: AppCopy["auth"] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const encodedUser = params.get("user");
    const redirectTo = params.get("redirectTo") ?? `/dashboard?lang=${locale}`;

    if (!accessToken || !refreshToken || !encodedUser) {
      setError(labels.error);
      return;
    }

    try {
      const user = JSON.parse(decodeBase64Url(encodedUser)) as AuthUser;
      saveAuthSession({ accessToken, refreshToken, user });
      router.replace(redirectTo);
    } catch {
      setError(labels.error);
    }
  }, [labels.error, locale, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-4 text-[#1c1917]">
      <section className="w-full max-w-lg border border-[#ded7cf] bg-white">
        <div className="border-b border-[#ded7cf] px-4 py-3">
          <h1 className="text-base font-bold text-[#171412]">[+] {labels.callbackTitle}</h1>
        </div>
        <div className="space-y-3 p-4 text-sm text-[#403a35]">
          <p>{labels.callbackBody}</p>
          {error ? <p className="rounded-[4px] border border-[#dc2626] bg-[#fff1f2] px-3 py-2 text-[#7f1d1d]">[!] {error}</p> : null}
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
