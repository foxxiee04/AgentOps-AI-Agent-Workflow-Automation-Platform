"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppCopy, Locale } from "../../lib/i18n";
import { clearAuthSession, readAuthSession, type AuthSession } from "./auth-client";

export function AuthStatus({ locale, labels }: { locale: Locale; labels: AppCopy["shell"] }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | undefined>();

  useEffect(() => {
    function syncSession() {
      setSession(readAuthSession());
    }

    syncSession();
    window.addEventListener("agentops-auth-change", syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("agentops-auth-change", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  function logout() {
    clearAuthSession();
    router.push(`/login?lang=${locale}`);
  }

  if (!session) {
    return null;
  }

  return (
    <div className="hidden items-center gap-2 rounded-[4px] border border-[#d5cec5] bg-white px-3 py-2 text-xs font-semibold text-[#4e4742] md:flex">
      <span className="max-w-[180px] truncate">
        {labels.signedIn}: {session.user.name}
      </span>
      <button type="button" onClick={logout} className="font-semibold text-[#171412] underline decoration-[#8f8379] underline-offset-4">
        {labels.logout}
      </button>
    </div>
  );
}
