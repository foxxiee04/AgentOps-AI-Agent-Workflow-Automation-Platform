"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useIconHover } from "../../components/motion";
import LogoutIcon from "../../icons/logout-icon";
import type { AppCopy, Locale } from "../../lib/i18n";
import { loadAuthUser, logout, type AuthUser } from "./auth-client";

export function AuthStatus({ locale, labels }: { locale: Locale; labels: AppCopy["shell"] }) {
  const router = useRouter();
  const { ref: iconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();
  const [user, setUser] = useState<AuthUser | undefined>();

  useEffect(() => {
    let cancelled = false;

    function syncSession() {
      void loadAuthUser().then((nextUser) => {
        if (!cancelled) {
          setUser(nextUser);
        }
      });
    }

    syncSession();
    window.addEventListener("agentops-auth-change", syncSession);
    return () => {
      cancelled = true;
      window.removeEventListener("agentops-auth-change", syncSession);
    };
  }, []);

  async function onLogout() {
    await logout();
    router.push(`/login?lang=${locale}`);
  }

  if (!user) {
    return null;
  }

  return (
    <div className="hidden items-center gap-2 rounded-full border border-[var(--hairline)] bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[var(--body)] md:flex">
      <span className="max-w-[180px] truncate">
        {labels.signedIn}: {user.name}
      </span>
      <button
        type="button"
        onClick={onLogout}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink-deep)] underline decoration-[var(--hairline-strong)] underline-offset-4"
      >
        <LogoutIcon ref={iconRef} size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        {labels.logout}
      </button>
    </div>
  );
}
