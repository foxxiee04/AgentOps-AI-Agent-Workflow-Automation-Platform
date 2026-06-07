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
    <div className="inline-flex rounded-[4px] border border-[#d5cec5] bg-white p-0.5 text-xs font-semibold text-[#4e4742]">
      {(["vi", "en"] as const).map((item) => (
        <Link
          key={item}
          href={hrefFor(item)}
          className={clsx(
            "min-h-8 rounded-[3px] px-2.5 py-1.5",
            locale === item ? "bg-[#1d1a18] text-[#ffffff]" : "text-[#5f5750] hover:bg-[#f2eee9]"
          )}
        >
          {item.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
