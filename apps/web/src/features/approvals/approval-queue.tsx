"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { humanApprovalViewSchema, type HumanApprovalView } from "@agentops/shared";
import { EmptyState, ErrorState, LoadingState, type DataStateLabels } from "../../components/data-state";
import {
  DURATION,
  EASE_OUT,
  LiveCursor,
  Reveal,
  Stagger,
  StaggerItem,
  staggerDelay,
  useIconHover
} from "../../components/motion";
import RefreshIcon from "../../icons/refresh-icon";
import {
  ApiError,
  approvalErrorKey,
  decideApproval,
  fetchPendingApprovals,
  type ApprovalDecisionRequest
} from "../../lib/api";
import { useActiveWorkspace } from "../auth/use-active-workspace";
import type { Locale } from "../../lib/i18n";
import {
  ApprovalCard,
  ApprovalSuccessLine,
  approvalCopy,
  type ApprovalCardState,
  type ApprovalCopy,
  type ApprovalDraft,
  type ApprovalLabels
} from "./approval-card";

export const APPROVAL_POLL_INTERVAL_MS = 5_000;
/** How long a decided approval stays in the "Just decided" block. */
export const APPROVAL_OUTCOME_MS = 6_000;
/** The "Just decided" block never shows more than this many outcomes. */
export const APPROVAL_OUTCOME_LIMIT = 5;

/**
 * A decision that loses the race returns HTTP 409 with the current approval view in `details`.
 * Returns that view so the queue can keep the card visible with its real (decided) status.
 */
export function conflictApproval(error: unknown): HumanApprovalView | undefined {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return undefined;
  }
  const parsed = humanApprovalViewSchema.safeParse(error.details);
  return parsed.success ? parsed.data : undefined;
}

export type ApprovalQueueLabels = ApprovalLabels & {
  empty: string;
  autoRefresh: string;
  approved: string;
  rejected: string;
  conflict: string;
  forbidden: string;
  unauthorized: string;
  failed: string;
};

/** A decision the queue made, kept locally until its outcome line expires. */
export type RecentApprovalOutcome = {
  approvalId: string;
  runId: string;
  kind: "approved" | "rejected";
  at: number;
};

/**
 * The cards the queue should render. A decided approval is hidden even while a stale
 * refetch still returns it; a conflict view replaces the server copy when both exist.
 */
export function visibleApprovals(
  approvals: HumanApprovalView[],
  outcomes: RecentApprovalOutcome[],
  conflicts: Record<string, HumanApprovalView> = {}
): HumanApprovalView[] {
  const decided = new Set(outcomes.map((outcome) => outcome.approvalId));
  return approvals
    .filter((approval) => !decided.has(approval.id))
    .map((approval) => conflicts[approval.id] ?? approval);
}

/** The "Just decided" block: outcome lines kept independently of the server list. */
export function ApprovalOutcomes({ outcomes, locale }: { outcomes: RecentApprovalOutcome[]; locale: Locale }) {
  if (outcomes.length === 0) {
    return null;
  }
  const copy = approvalCopy[locale];
  return (
    <section className="space-y-2" aria-label={copy.recentlyDecided}>
      <h2 className="font-mono text-xs font-bold uppercase text-[var(--mute)]">{copy.recentlyDecided}</h2>
      {outcomes.map((outcome) => (
        <Reveal key={`${outcome.approvalId}-${outcome.at}`}>
          <ApprovalSuccessLine
            message={outcome.kind === "approved" ? copy.approved : copy.rejected}
            runId={outcome.runId}
            locale={locale}
          />
        </Reveal>
      ))}
    </section>
  );
}

/** Body of the decision request: the comment is optional for approve, the edited draft only for approve. */
export function approvalDecisionRequest(
  decision: "approve" | "reject",
  comment: string,
  editedEmail?: ApprovalDraft
): ApprovalDecisionRequest {
  return {
    decision,
    ...(comment.trim() ? { comment } : {}),
    ...(decision === "approve" && editedEmail ? { editedEmail } : {})
  };
}

/** The message for a failed decision; a rejection without a reason comes back as HTTP 400. */
export function approvalDecisionErrorMessage(
  error: unknown,
  decision: "approve" | "reject",
  labels: Pick<ApprovalQueueLabels, "conflict" | "forbidden" | "unauthorized" | "failed">,
  copy: ApprovalCopy
): string {
  if (decision === "reject" && error instanceof ApiError && error.status === 400) {
    return copy.rejectReason;
  }
  return labels[approvalErrorKey(error)];
}

export function ApprovalQueue({
  labels,
  states,
  locale,
  workspaceId: propWorkspaceId
}: {
  labels: ApprovalQueueLabels;
  states: DataStateLabels;
  locale: Locale;
  workspaceId?: string;
}) {
  const queryClient = useQueryClient();
  const { active } = useActiveWorkspace();
  const workspaceId = propWorkspaceId ?? active?.id ?? "";
  const copy = approvalCopy[locale];
  const [comments, setComments] = useState<Record<string, string>>({});
  const [cardStates, setCardStates] = useState<Record<string, ApprovalCardState>>({});
  const [outcomes, setOutcomes] = useState<RecentApprovalOutcome[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, HumanApprovalView>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const reduce = useReducedMotion() ?? false;
  const { ref: refreshRef, ...refreshHandlers } = useIconHover();

  const approvals = useQuery({
    queryKey: ["approvals", workspaceId],
    queryFn: () => fetchPendingApprovals(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: APPROVAL_POLL_INTERVAL_MS
  });

  const decision = useMutation({
    mutationFn: ({ approval, request }: { approval: HumanApprovalView; request: ApprovalDecisionRequest }) =>
      decideApproval(approval, request),
    onMutate: ({ approval }) => setCardStates((current) => ({ ...current, [approval.id]: { status: "working" } })),
    onSuccess: (result, { approval, request }) => {
      const outcome: RecentApprovalOutcome = {
        approvalId: approval.id,
        runId: result.approval.workflowRunId,
        kind: request.decision === "approve" ? "approved" : "rejected",
        at: Date.now()
      };
      setOutcomes((current) => [outcome, ...current.filter((item) => item.approvalId !== approval.id)].slice(0, APPROVAL_OUTCOME_LIMIT));
      setConflicts((current) => {
        if (!(approval.id in current)) {
          return current;
        }
        const next = { ...current };
        delete next[approval.id];
        return next;
      });
      setCardStates((current) => ({ ...current, [approval.id]: { status: "done" } }));
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["run", approval.workflowRunId] });
      // The outcome line lives on its own timer, independent of the queue refetch.
      const running = timers.current[approval.id];
      if (running) {
        clearTimeout(running);
      }
      timers.current[approval.id] = setTimeout(() => {
        setOutcomes((current) => current.filter((item) => item.approvalId !== approval.id));
        delete timers.current[approval.id];
      }, APPROVAL_OUTCOME_MS);
    },
    onError: (error, { approval, request }) => {
      const conflict = conflictApproval(error);
      if (conflict) {
        setConflicts((current) => ({ ...current, [approval.id]: conflict }));
      }
      // A rejected approval without a reason comes back as HTTP 400.
      const message = approvalDecisionErrorMessage(error, request.decision, labels, copy);
      setCardStates((current) => ({ ...current, [approval.id]: { status: "error", message } }));
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    }
  });

  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of Object.values(running)) {
        clearTimeout(timer);
      }
    };
  }, []);

  if (!workspaceId) {
    return <EmptyState title={labels.empty} />;
  }

  if (approvals.isPending) {
    return <LoadingState label={states.loading} />;
  }
  if (approvals.isError) {
    return <ErrorState labels={states} detail={approvals.error instanceof Error ? approvals.error.message : undefined} />;
  }

  const items = visibleApprovals(approvals.data, outcomes, conflicts);

  return (
    <div className="space-y-4">
      <ApprovalOutcomes outcomes={outcomes} locale={locale} />
      <p
        {...refreshHandlers}
        className="inline-flex flex-wrap items-center gap-1.5 font-mono text-xs text-[var(--mute)]"
        aria-live="polite"
      >
        <span aria-hidden="true" inert className="inline-flex shrink-0">
          <RefreshIcon ref={refreshRef} size={16} strokeWidth={1.75} />
        </span>
        ● {labels.autoRefresh} · {approvals.data.length} <LiveCursor />
      </p>
      <Stagger className="space-y-4">
        <AnimatePresence initial={false}>
          {items.map((approval, index) => (
            <StaggerItem
              key={approval.id}
              layout
              delay={staggerDelay(index)}
              className="overflow-hidden"
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }
              }
              transition={{
                duration: reduce ? DURATION.reducedFade : DURATION.base,
                ease: EASE_OUT,
                layout: { duration: DURATION.base, ease: EASE_OUT }
              }}
            >
              <ApprovalCard
                approval={approval}
                labels={labels}
                locale={locale}
                comment={comments[approval.id] ?? ""}
                state={cardStates[approval.id] ?? { status: "idle" }}
                onCommentChange={(value) => setComments((current) => ({ ...current, [approval.id]: value }))}
                onDecide={(value, editedEmail) => {
                  decision.mutate({ approval, request: approvalDecisionRequest(value, comments[approval.id] ?? "", editedEmail) });
                }}
              />
            </StaggerItem>
          ))}
          {items.length === 0 ? (
            <StaggerItem key="approvals-empty">
              <EmptyState title={labels.empty} />
            </StaggerItem>
          ) : null}
        </AnimatePresence>
      </Stagger>
    </div>
  );
}
