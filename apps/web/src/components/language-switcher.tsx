"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { motion } from "motion/react";
import type { Locale } from "../lib/i18n";

const CHIP_SPRING = { type: "spring", visualDuration: 0.35, bounce: 0 } as const;

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(nextLocale: Locale) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLocale);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="inline-flex rounded-xl border border-[var(--hairline)] bg-white p-0.5 text-xs font-semibold text-[var(--body)]">
      {(["vi", "en"] as const).map((item) => {
        const isActive = locale === item;

        return (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={isActive ? "true" : undefined}
            className={clsx(
              "relative min-h-8 rounded-lg px-2.5 py-1.5",
              isActive ? "text-[var(--accent)]" : "text-[var(--mute)] hover:bg-[var(--surface-soft)]"
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="language-active"
                aria-hidden="true"
                transition={CHIP_SPRING}
                className="absolute inset-0 rounded-lg bg-[var(--accent-soft)]"
              />
            ) : null}
            <span className="relative">{item.toUpperCase()}</span>
          </Link>
        );
      })}
    </div>
  );
}
