"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { refreshBrowserSession } from "../../lib/api";
import type { AppCopy, Locale } from "../../lib/i18n";
import { authPost, googleAuthHref, setAuthUser } from "./auth-client";

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

  useEffect(() => {
    if (mode !== "login") {
      return;
    }

    let cancelled = false;
    void refreshBrowserSession().then((refreshed) => {
      if (refreshed && !cancelled) {
        router.replace(nextPath);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mode, nextPath, router]);

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
      setAuthUser(session.user);
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
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">AO</span>
          <span className="font-semibold text-[var(--ink-deep)]">AgentOps</span>
        </Link>
        <p className="mt-10 text-sm font-semibold uppercase text-[var(--mute)]">
          {mode === "login" ? labels.loginEyebrow : labels.registerEyebrow}
        </p>
        <h1 className="mt-2 max-w-xl text-4xl font-bold leading-tight text-[var(--ink-deep)]">
          {mode === "login" ? labels.loginTitle : labels.registerTitle}
        </h1>
        <div className="mt-8 rounded-xl border border-[var(--hairline)] bg-white p-4 text-sm leading-6 text-[var(--body)]">
          <p className="font-semibold text-[var(--ink-deep)]">AgentOps workspace session</p>
          <p className="mt-2">✓ workspace role: OWNER</p>
          <p>✓ routes: dashboard, workflows, runs, agents, settings</p>
          <p>✓ guarded app surface ready</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--hairline)] bg-white">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--ink-deep)]">{mode === "login" ? labels.submitLogin : labels.submitRegister}</h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-4">
          {mode === "register" ? (
            <label className="block text-sm font-semibold text-[var(--body)]">
              {labels.name}
              <input
                name="name"
                required
                minLength={2}
                className="mt-2 h-11 w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 text-[var(--ink-deep)]"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-[var(--body)]">
            {labels.email}
            <input
              name="email"
              required
              type="email"
              className="mt-2 h-11 w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 text-[var(--ink-deep)]"
              autoComplete="email"
            />
          </label>

          <label className="block text-sm font-semibold text-[var(--body)]">
            {labels.password}
            <input
              name="password"
              required
              type="password"
              minLength={8}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 text-[var(--ink-deep)]"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error ? <p className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-ink)]">⚠ {error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
          >
            {isSubmitting ? labels.submitting : mode === "login" ? labels.submitLogin : labels.submitRegister}
          </button>

          <a
            href={googleAuthHref(nextPath)}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--hairline-strong)] bg-white px-4 text-sm font-semibold text-[var(--ink)]"
          >
            {labels.google}
          </a>
        </form>

        <div className="border-t border-[var(--hairline)] px-4 py-3 text-sm text-[var(--mute)]">
          {mode === "login" ? labels.noAccount : labels.hasAccount}{" "}
          <Link href={otherHref} className="font-semibold text-[var(--ink-deep)] underline decoration-[var(--hairline-strong)] underline-offset-4">
            {mode === "login" ? labels.createAccount : labels.backToLogin}
          </Link>
        </div>
      </section>
    </div>
  );
}
