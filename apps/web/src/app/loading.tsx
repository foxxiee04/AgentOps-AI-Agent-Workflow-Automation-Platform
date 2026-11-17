import { LoadingState } from "../components/data-state";

export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--canvas)] px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="relative grid h-9 w-9 shrink-0 place-items-center text-[var(--accent)]">
            <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
              <path
                d="M16 2.4 28 9.3v13.4L16 29.6 4 22.7V9.3Z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <circle cx="16" cy="16" r="2.8" fill="var(--live)" />
            </svg>
          </span>
          <span className="font-display text-[22px] leading-none text-[var(--ink)]">AgentOps</span>
        </div>

        <div className="mt-6" aria-hidden="true">
          <div className="h-2.5 w-40 rounded-full bg-[var(--surface-soft)] motion-safe:animate-pulse" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-card)] motion-safe:animate-pulse" />
            <div className="h-20 rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-card)] motion-safe:animate-pulse [animation-delay:150ms]" />
          </div>
        </div>

        <div className="mt-6">
          <LoadingState label="Đang tải dữ liệu... / Loading data..." />
        </div>
      </div>
    </div>
  );
}
