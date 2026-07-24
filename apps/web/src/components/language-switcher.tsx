"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import type { Locale } from "../lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(nextLocale: Locale) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLocale);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="inline-flex rounded-[8px] border border-[var(--hairline)] bg-white p-0.5 text-xs font-semibold text-[var(--body)]">
      {(["vi", "en"] as const).map((item) => (
        <Link
          key={item}
          href={hrefFor(item)}
          className={clsx(
            "min-h-8 rounded-[7px] px-2.5 py-1.5",
            locale === item ? "bg-[var(--accent-soft)] text-[#17337a]" : "text-[var(--mute)] hover:bg-[#f8faff]"
          )}
        >
          {item.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
