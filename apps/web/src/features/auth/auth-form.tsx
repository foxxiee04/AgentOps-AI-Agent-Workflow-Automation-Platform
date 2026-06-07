"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import type { AppCopy, Locale } from "../../lib/i18n";
import { authPost, googleAuthHref, saveAuthSession } from "./auth-client";

type AuthFormMode = "login" | "register";

export function AuthForm({ mode, locale, labels }: { mode: AuthFormMode; locale: Locale; labels: AppCopy["auth"] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(searchParams.get("authError") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//") && !next.includes("://")) {
      return next;
    }

    return `/dashboard?lang=${locale}`;
  }, [locale, searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? "")
      };
      const session = await authPost(
        mode === "login" ? "/auth/login" : "/auth/register",
        mode === "login" ? payload : { ...payload, name: String(form.get("name") ?? "") }
      );
      saveAuthSession(session);
      router.replace(nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : labels.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const otherHref =
    mode === "login"
      ? `/register?lang=${locale}&next=${encodeURIComponent(nextPath)}`
      : `/login?lang=${locale}&next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl content-center gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <section>
        <Link href={locale === "vi" ? "/vi" : "/en"} className="inline-flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[4px] bg-[#1d1a18] text-sm font-bold text-[#ffffff]">AO</span>
          <span className="font-semibold text-[#171412]">AgentOps</span>
        </Link>
        <p className="mt-10 text-sm font-semibold uppercase text-[#6b625a]">
          {mode === "login" ? labels.loginEyebrow : labels.registerEyebrow}
        </p>
        <h1 className="mt-2 max-w-xl text-4xl font-bold leading-tight text-[#171412]">
          {mode === "login" ? labels.loginTitle : labels.registerTitle}
        </h1>
        <div className="mt-8 border border-[#171412] bg-[#171412] p-4 font-mono text-sm leading-6 text-[#fdfaf6]">
          <p>$ agentops auth session --workspace ws_demo</p>
          <p>&gt; workspace role: OWNER</p>
          <p>&gt; routes: dashboard workflows runs agents settings</p>
          <p>[ok] guarded app surface ready</p>
        </div>
      </section>

      <section className="border border-[#ded7cf] bg-white">
        <div className="border-b border-[#ded7cf] px-4 py-3">
          <h2 className="text-base font-bold text-[#171412]">[+] {mode === "login" ? labels.submitLogin : labels.submitRegister}</h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-4">
          {mode === "register" ? (
            <label className="block text-sm font-semibold text-[#403a35]">
              {labels.name}
              <input
                name="name"
                required
                minLength={2}
                className="mt-2 h-11 w-full rounded-[4px] border border-[#d5cec5] bg-[#fbfaf7] px-3 text-[#171412]"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-[#403a35]">
            {labels.email}
            <input
              name="email"
              required
              type="email"
              className="mt-2 h-11 w-full rounded-[4px] border border-[#d5cec5] bg-[#fbfaf7] px-3 text-[#171412]"
              autoComplete="email"
            />
          </label>

          <label className="block text-sm font-semibold text-[#403a35]">
            {labels.password}
            <input
              name="password"
              required
              type="password"
              minLength={8}
              className="mt-2 h-11 w-full rounded-[4px] border border-[#d5cec5] bg-[#fbfaf7] px-3 text-[#171412]"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error ? <p className="rounded-[4px] border border-[#dc2626] bg-[#fff1f2] px-3 py-2 text-sm text-[#7f1d1d]">[!] {error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-[4px] bg-[#1d1a18] px-4 text-sm font-semibold text-[#ffffff] disabled:bg-[#f2eee9] disabled:text-[#9a9898]"
          >
            {isSubmitting ? labels.submitting : mode === "login" ? labels.submitLogin : labels.submitRegister}
          </button>

          <a
            href={googleAuthHref(nextPath)}
            className="flex min-h-11 w-full items-center justify-center rounded-[4px] border border-[#8f8379] bg-white px-4 text-sm font-semibold text-[#1c1917]"
          >
            {labels.google}
          </a>
        </form>

        <div className="border-t border-[#ded7cf] px-4 py-3 text-sm text-[#5f5750]">
          {mode === "login" ? labels.noAccount : labels.hasAccount}{" "}
          <Link href={otherHref} className="font-semibold text-[#171412] underline decoration-[#8f8379] underline-offset-4">
            {mode === "login" ? labels.createAccount : labels.backToLogin}
          </Link>
        </div>
      </section>
    </div>
  );
}
