"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { refreshBrowserSession } from "../../lib/api";
import type { AppCopy, Locale } from "../../lib/i18n";
import { authPost, googleAuthHref, setAuthUser } from "./auth-client";
import { MaskHeading } from "../../components/motion/mask-heading";

type AuthFormMode = "login" | "register";

const workflowNodes = [
  { type: "TRIGGER", title: "Lead form" },
  { type: "AI AGENT", title: "Score lead" },
  { type: "APPROVAL", title: "Human review" }
];

const bullets = {
  vi: ["workspace role: OWNER", "routes: dashboard, workflows, runs, agents, settings", "guarded app surface ready"],
  en: ["workspace role: OWNER", "routes: dashboard, workflows, runs, agents, settings", "guarded app surface ready"]
};

const taglines = {
  vi: "Mỗi bước chạy đều được duyệt, ghi log và lưu bằng chứng.",
  en: "Every run is reviewed, logged and evidenced."
};

const runningLabel = {
  vi: "Đang chạy",
  en: "Running"
};

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative grid h-9 w-9 shrink-0 place-items-center text-[var(--accent)]"
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
        <path
          d="M16 2.4 28 9.3v13.4L16 29.6 4 22.7V9.3Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path d="M16 10.5v11M10.2 13.8l11.6 6.4M21.8 13.8l-11.6 6.4" stroke="currentColor" strokeWidth={1} strokeOpacity={0.35} />
        <circle cx="16" cy="16" r="2.8" fill="var(--live)" />
      </svg>
    </span>
  );
}

export function AuthForm({ mode, locale, labels }: { mode: AuthFormMode; locale: Locale; labels: AppCopy["auth"] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion() ?? false;
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

  const title = mode === "login" ? labels.loginTitle : labels.registerTitle;
  const eyebrow = mode === "login" ? labels.loginEyebrow : labels.registerEyebrow;
  const submitLabel = mode === "login" ? labels.submitLogin : labels.submitRegister;
  const orLabel = locale === "vi" ? "hoặc" : "or";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hairline-grid relative hidden flex-col overflow-hidden bg-[var(--mist)] p-10 lg:flex">
        <span aria-hidden="true" className="crosshair absolute left-6 top-6 h-2 w-2" />
        <span aria-hidden="true" className="crosshair absolute bottom-6 right-6 h-2 w-2" />

        <Link
          href={locale === "vi" ? "/vi" : "/en"}
          className="relative z-10 inline-flex w-fit items-center gap-2.5"
        >
          <BrandMark />
          <span className="font-display text-[21px] leading-none text-[var(--ink)]">AgentOps</span>
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto w-full max-w-[360px]">
            <p className="mono-label">{eyebrow}</p>
            {/* Decorative repeat of the form title: hidden from assistive tech so the page keeps one heading. */}
            <div aria-hidden="true">
              <MaskHeading
                as="h2"
                className="mt-2 font-display text-[48px] leading-[1.05] text-[var(--ink)]"
              >
                {title}
              </MaskHeading>
            </div>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[var(--mute)]">{taglines[locale]}</p>

            <motion.div
              className="mx-auto mt-10 w-[316px]"
              animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
              transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <ol className="flex flex-col gap-3">
                {workflowNodes.map((node, index) => (
                  <li
                    key={node.title}
                    className="relative w-[260px]"
                    style={{ marginLeft: index * 28 }}
                  >
                    {index > 0 ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-[var(--accent)]"
                      >
                        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
                      </span>
                    ) : null}
                    <div className="glass rounded-[var(--radius-card)] border border-[var(--hairline)] px-4 py-3 shadow-[var(--shadow-sm)]">
                      <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                        <p className="mono-label">{node.type}</p>
                        {index === 1 ? (
                          <span className="live-chip is-running">{runningLabel[locale]}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 whitespace-nowrap text-sm font-medium text-[var(--ink)]">{node.title}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
        </div>

        <ul className="relative z-10 space-y-2">
          {bullets[locale].map((item) => (
            <li key={item} className="mono-label text-[var(--mute)]">+ {item}</li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center px-4 py-10 lg:px-10">
        <div className="card w-full max-w-[400px] p-6">
          <p className="mono-label">{eyebrow}</p>
          <MaskHeading as="h1" className="mt-2 font-display text-[30px] leading-[1.1] text-[var(--ink)]">
            {title}
          </MaskHeading>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <a
              href={googleAuthHref(nextPath)}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-sm)]"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {labels.google}
            </a>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--hairline-strong)]" />
              <span className="mono-label text-[var(--mute)]">{orLabel}</span>
              <span className="h-px flex-1 bg-[var(--hairline-strong)]" />
            </div>

            {mode === "register" ? (
              <label className="block text-sm font-medium text-[var(--body)]">
                {labels.name}
                <input
                  name="name"
                  required
                  minLength={2}
                  className="field mt-2"
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="block text-sm font-medium text-[var(--body)]">
              {labels.email}
              <input
                name="email"
                required
                type="email"
                className="field mt-2"
                autoComplete="email"
              />
            </label>

            <label className="block text-sm font-medium text-[var(--body)]">
              {labels.password}
              <input
                name="password"
                required
                type="password"
                minLength={8}
                className="field mt-2"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-ink)]">
                ⚠ {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? labels.submitting : submitLabel}
            </button>
          </form>

          <div className="mt-4 text-sm text-[var(--mute)]">
            {mode === "login" ? labels.noAccount : labels.hasAccount}{" "}
            <Link href={otherHref} className="font-medium text-[var(--accent)] underline underline-offset-4">
              {mode === "login" ? labels.createAccount : labels.backToLogin}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
