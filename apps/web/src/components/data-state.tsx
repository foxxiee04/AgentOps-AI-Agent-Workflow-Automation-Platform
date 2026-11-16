import type { ReactNode } from "react";
import type { ApiResource } from "../lib/api";

export type DataStateLabels = {
  loading: string;
  errorTitle: string;
  errorBody: string;
  demoBanner: string;
  emptyTitle: string;
  retry: string;
};

/** Banner for demo data; nothing for live data. Error resources are handled by `ResourceView`. */
export function DataNotice({ resource, labels }: { resource: Pick<ApiResource<unknown>, "source">; labels: DataStateLabels }) {
  if (resource.source !== "fallback") {
    return null;
  }
  return (
    <div role="status" className="rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning-ink)]">
      ⚠ {labels.demoBanner}
    </div>
  );
}

export function ErrorState({ labels, detail }: { labels: DataStateLabels; detail?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-4 text-sm text-[var(--danger-ink)]">
      <p className="font-bold">✕ {labels.errorTitle}</p>
      <p className="mt-1">{labels.errorBody}</p>
      {detail ? <p className="mt-2 break-all font-mono text-xs">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-soft)] px-4 py-8 text-center text-sm text-[var(--body)]">
      <p className="font-bold text-[var(--ink)]">{title}</p>
      {body ? <p className="mt-1">{body}</p> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-6 text-sm text-[var(--mute)]">
      <span className="font-mono">[..]</span> {label}
    </div>
  );
}

/** Renders the error state for unreachable APIs, otherwise the demo banner (if any) and the content. */
export function ResourceView<T>({
  resource,
  labels,
  children
}: {
  resource: ApiResource<T>;
  labels: DataStateLabels;
  children: (data: T) => ReactNode;
}) {
  if (resource.source === "error") {
    return <ErrorState labels={labels} detail={resource.error} />;
  }
  return (
    <>
      <DataNotice resource={resource} labels={labels} />
      {children(resource.data)}
    </>
  );
}
