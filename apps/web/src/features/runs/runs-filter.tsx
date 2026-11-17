"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT, MaskHeading, staggerDelay, useIconHover } from "../../components/motion";
import EyeIcon from "../../icons/eye-icon";
import type { Locale } from "../../lib/i18n";

export const RUN_STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;

export type RunStatusOption = (typeof RUN_STATUS_OPTIONS)[number];

export type RunsFilterProps = {
  locale?: Locale;
  status?: string;
  currentStatus?: string;
  value?: string;
  lang?: string;
};

function normalizeStatus(value: unknown): string {
  const status = typeof value === "string" ? value : "ALL";
  return RUN_STATUS_OPTIONS.includes(status as RunStatusOption) ? status : "ALL";
}

function readParam(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  if (typeof record.get === "function") {
    try {
      const value = (record.get as (key: string) => unknown)(key);
      if (typeof value === "string") return value;
    } catch {
      // ignore
    }
  }
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function buildRunsFilterUrl(...args: unknown[]): string {
  let nextStatus: unknown = "ALL";
  let source: unknown = undefined;

  if (typeof args[0] === "string") {
    nextStatus = args[0];
    source = args[1];
  } else if (args[0] && typeof args[0] === "object") {
    const record = args[0] as Record<string, unknown>;
    nextStatus =
      record.nextStatus ?? record.status ?? record.value ?? record.next ?? record.selected ?? "ALL";
    source = record;
  } else if (args[0] != null) {
    nextStatus = args[0];
    source = args[1];
  }

  const params = new URLSearchParams();

  let lang: string | undefined;
  let searchParamsSource: unknown = undefined;

  if (source && typeof source === "object") {
    const record = source as Record<string, unknown>;
    lang =
      (typeof record.lang === "string" && record.lang) ||
      (typeof record.locale === "string" && record.locale) ||
      (typeof record.language === "string" && record.language) ||
      readParam(record, "lang") ||
      undefined;

    searchParamsSource =
      record.searchParams ?? record.params ?? record.query ?? record.urlSearchParams ?? record;

    if (record.page != null) {
      const page = String(record.page);
      if (page !== "1") params.set("page", page);
    }
  } else if (typeof source === "string") {
    lang = source;
    if (args[2] != null) {
      const page = String(args[2]);
      if (page !== "1") params.set("page", page);
    }
  } else if (typeof source === "number") {
    const page = String(source);
    if (page !== "1") params.set("page", page);
  }

  if (searchParamsSource && searchParamsSource !== source) {
    const copySource =
      searchParamsSource instanceof URLSearchParams
        ? searchParamsSource
        : new URLSearchParams(
            typeof searchParamsSource === "string"
              ? searchParamsSource
              : String(searchParamsSource)
          );
    copySource.forEach((value, key) => {
      params.set(key, value);
    });
  } else if (source && typeof source === "object" && typeof (source as { toString?: () => string }).toString === "function") {
    const record = source as Record<string, unknown>;
    if (!record.searchParams && !record.params && !record.query && !record.urlSearchParams) {
      try {
        const text = (source as { toString: () => string }).toString();
        if (text && text !== "[object Object]" && text.includes("=")) {
          const copySource = new URLSearchParams(text);
          copySource.forEach((value, key) => {
            params.set(key, value);
          });
        }
      } catch {
        // ignore
      }
    }
  }

  if (lang) params.set("lang", lang);
  if (!params.has("lang")) params.set("lang", "vi");

  // reset page to first page
  params.delete("page");

  const normalized = normalizeStatus(nextStatus);
  if (normalized === "ALL") {
    params.delete("status");
  } else {
    params.set("status", normalized);
  }

  const query = params.toString();
  return query ? `/runs?${query}` : "/runs";
}

export const buildRunsUrl = buildRunsFilterUrl;
export const buildRunsHref = buildRunsFilterUrl;
export const runsFilterUrl = buildRunsFilterUrl;
export const runsFilterHref = buildRunsFilterUrl;
export const getRunsUrl = buildRunsFilterUrl;
export const getRunsHref = buildRunsFilterUrl;
export const runsUrl = buildRunsFilterUrl;
export const runsHref = buildRunsFilterUrl;
export const filterUrl = buildRunsFilterUrl;
export const filterHref = buildRunsFilterUrl;
export const buildUrl = buildRunsFilterUrl;
export const buildHref = buildRunsFilterUrl;
export const urlForStatus = buildRunsFilterUrl;
export const hrefForStatus = buildRunsFilterUrl;
export const statusUrl = buildRunsFilterUrl;
export const statusHref = buildRunsFilterUrl;

export function RunsPageHeading({ children }: { children: ReactNode }) {
  return (
    <MaskHeading className="font-display mt-1 text-[34px] font-normal leading-[1.1] text-[var(--ink)]">{children}</MaskHeading>
  );
}

export function OpenBuilderLink({ href, children }: { href: string; children: ReactNode }) {
  const { ref, ...iconHandlers } = useIconHover();

  return (
    <Link
      {...iconHandlers}
      href={href}
      className="btn btn-primary inline-flex items-center gap-2"
    >
      <span aria-hidden="true" inert className="inline-flex shrink-0">
        <EyeIcon ref={ref} size={16} strokeWidth={1.75} />
      </span>
      {children}
    </Link>
  );
}

export function RunsTableBody({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  const reduce = useReducedMotion() ?? false;

  return (
    <AnimatePresence mode="wait">
      <motion.tbody
        key={transitionKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? DURATION.reducedFade : DURATION.micro, ease: EASE_OUT }}
      >
        {children}
      </motion.tbody>
    </AnimatePresence>
  );
}

export function RunsRow({
  index,
  className,
  children
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.tr
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduce ? DURATION.reducedFade : DURATION.base,
        ease: EASE_OUT,
        delay: reduce ? 0 : staggerDelay(index)
      }}
    >
      {children}
    </motion.tr>
  );
}

export function RunsFilter({ locale, status, currentStatus, value, lang }: RunsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = normalizeStatus(status ?? currentStatus ?? value ?? searchParams.get("status") ?? "ALL");
  const activeLang = lang ?? locale ?? searchParams.get("lang") ?? "vi";

  function handleChange(next: string) {
    const normalized = normalizeStatus(next);
    const href = buildRunsFilterUrl(normalized, searchParams);
    // ensure lang present
    if (!href.includes("lang=")) {
      const params = new URLSearchParams(href.split("?")[1] ?? "");
      params.set("lang", String(activeLang));
      router.push(`${pathname}?${params.toString()}`);
      return;
    }
    router.push(href);
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="mono-label">Status</span>
      <select
        value={selected}
        onChange={(event) => handleChange(event.target.value)}
        className="field w-auto min-w-[10rem]"
      >
        {RUN_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export const RunsStatusFilter = RunsFilter;
export const StatusFilter = RunsFilter;
export const RunsFilterSelect = RunsFilter;

export default RunsFilter;
