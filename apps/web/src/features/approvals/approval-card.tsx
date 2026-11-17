"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type { HumanApprovalView } from "@agentops/shared";
import { DURATION, EASE_OUT, useIconHover } from "../../components/motion";
import { StatusPill } from "../../components/status-pill";
import type { Locale } from "../../lib/i18n";
import { approvalStatusTone, formatDateTime } from "../../lib/status";
import EyeIcon from "../../icons/eye-icon";
import SendIcon from "../../icons/send-icon";
import XIcon from "../../icons/x-icon";

export type ApprovalLabels = {
  lead: string;
  assessment: string;
  score: string;
  category: string;
  summary: string;
  recommended: string;
  email: string;
  subject: string;
  body: string;
  comment: string;
  approve: string;
  reject: string;
  working: string;
  openRun: string;
  requestedAt: string;
};

export type ApprovalCardState = { status: "idle" | "working" | "done" | "error"; message?: string };

/** Copy for the review flow that lib/i18n.ts does not carry yet. */
export type ApprovalCopy = {
  edit: string;
  close: string;
  undo: string;
  edited: string;
  note: string;
  rejectReason: string;
  emptyDraft: string;
  approved: string;
  rejected: string;
  openRun: string;
  recentlyDecided: string;
};

export const approvalCopy: Record<Locale, ApprovalCopy> = {
  vi: {
    edit: "Sửa",
    close: "Đóng",
    undo: "Hoàn tác",
    edited: "Đã sửa bản nháp",
    note: "Lý do / ghi chú",
    rejectReason: "Nhập lý do từ chối (ít nhất 3 ký tự)",
    emptyDraft: "Tiêu đề và nội dung không được để trống",
    approved: "Đã duyệt và gửi email",
    rejected: "Đã từ chối · vẫn tạo task cho sales",
    openRun: "Xem run →",
    recentlyDecided: "Vừa xử lý"
  },
  en: {
    edit: "Edit",
    close: "Close",
    undo: "Undo",
    edited: "Draft edited",
    note: "Reason / note",
    rejectReason: "Enter a rejection reason (at least 3 characters)",
    emptyDraft: "Subject and body cannot be empty",
    approved: "Approved and email sent",
    rejected: "Rejected · a sales task is still created",
    openRun: "View run →",
    recentlyDecided: "Just decided"
  }
};

/** The email a reviewer may edit before approving. */
export type ApprovalDraft = { subject: string; body: string };

export type ApprovalDecisionPlan =
  | { kind: "send"; decision: "approve" | "reject"; editedEmail?: ApprovalDraft }
  | { kind: "invalid"; message: string };

/**
 * Turns a click into a decision the API accepts: rejecting needs a reason of at least
 * 3 non-space characters, and an edited draft may not be blank.
 */
export function planApprovalDecision(input: {
  decision: "approve" | "reject";
  comment: string;
  draft?: ApprovalDraft;
  original?: ApprovalDraft;
  locale: Locale;
}): ApprovalDecisionPlan {
  const copy = approvalCopy[input.locale];
  if (input.decision === "reject" && input.comment.trim().length < 3) {
    return { kind: "invalid", message: copy.rejectReason };
  }
  const original = input.original ?? { subject: "", body: "" };
  const draft = input.draft ?? original;
  const edited = draft.subject !== original.subject || draft.body !== original.body;
  if (edited && (draft.subject.trim() === "" || draft.body.trim() === "")) {
    return { kind: "invalid", message: copy.emptyDraft };
  }
  return {
    kind: "send",
    decision: input.decision,
    ...(edited && input.decision === "approve" ? { editedEmail: { subject: draft.subject, body: draft.body } } : {})
  };
}

/**
 * Runs a decision: an invalid one never reaches the API, it shows the reason and
 * puts the cursor back in the note field.
 */
export function submitApprovalDecision(args: {
  decision: "approve" | "reject";
  comment: string;
  draft?: ApprovalDraft;
  original?: ApprovalDraft;
  locale: Locale;
  onDecide: (decision: "approve" | "reject", editedEmail?: ApprovalDraft) => void;
  onInvalid: (message: string) => void;
  focusNote?: () => void;
}) {
  const plan = planApprovalDecision(args);
  if (plan.kind === "invalid") {
    args.onInvalid(plan.message);
    args.focusNote?.();
    return;
  }
  args.onDecide(plan.decision, plan.editedEmail);
}

/** The email panel: read-only by default, editable once the reviewer asks for it. */
export function ApprovalDraftPanel({
  approval,
  labels,
  locale,
  editing,
  draft,
  edited,
  onToggle,
  onChange,
  onUndo
}: {
  approval: HumanApprovalView;
  labels: ApprovalLabels;
  locale: Locale;
  editing: boolean;
  draft: ApprovalDraft;
  edited: boolean;
  onToggle: () => void;
  onChange: (draft: ApprovalDraft) => void;
  onUndo: () => void;
}) {
  const copy = approvalCopy[locale];
  const email = approval.review.email;
  const subjectId = `subject-${approval.id}`;
  const bodyId = `body-${approval.id}`;
  const reduce = useReducedMotion() ?? false;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="mono-label">{labels.email}</h3>
        {approval.status === "WAITING_APPROVAL" ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={editing}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--ink)]"
          >
            {editing ? copy.close : copy.edit}
          </button>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface-raised)] shadow-[var(--shadow-sm)]">
        {editing ? (
          <motion.div
            className="space-y-2 px-3 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? DURATION.reducedFade : DURATION.micro, ease: EASE_OUT }}
          >
            <div>
              <label htmlFor={subjectId} className="block text-xs font-semibold text-[var(--mute)]">
                {labels.subject}
              </label>
              <input
                id={subjectId}
                value={draft.subject}
                maxLength={300}
                onChange={(event) => onChange({ ...draft, subject: event.target.value })}
                className="field w-full rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor={bodyId} className="block text-xs font-semibold text-[var(--mute)]">
                {labels.body}
              </label>
              <textarea
                id={bodyId}
                value={draft.body}
                maxLength={10000}
                rows={8}
                onChange={(event) => onChange({ ...draft, body: event.target.value })}
                 className="field w-full rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-sm leading-6"
              />
            </div>
            <button
              type="button"
              onClick={onUndo}
              disabled={!edited}
              className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--ink)] disabled:border-[var(--hairline)] disabled:text-[var(--mute)]"
            >
              {copy.undo}
            </button>
          </motion.div>
        ) : (
          <>
            <p className="border-b border-[var(--hairline)] px-3 py-2">
              <span className="text-[var(--mute)]">{labels.subject}: </span>
              <span className="font-display text-[var(--ink)]">{email.subject ?? "-"}</span>
            </p>
            <p className="whitespace-pre-wrap px-3 py-3 leading-6 text-[var(--ink)]" aria-label={labels.body}>
              {email.body ?? "-"}
            </p>
          </>
        )}
      </div>

      {edited ? <p className="font-mono text-xs text-[var(--mute)]">● {copy.edited}</p> : null}
    </>
  );
}

/** One email waiting for review. The parent owns the decision request. */
export function ApprovalCard({
  approval,
  labels,
  locale,
  comment,
  state,
  onCommentChange,
  onDecide
}: {
  approval: HumanApprovalView;
  labels: ApprovalLabels;
  locale: Locale;
  comment: string;
  state: ApprovalCardState;
  onCommentChange: (value: string) => void;
  onDecide: (decision: "approve" | "reject", editedEmail?: ApprovalDraft) => void;
}) {
  const { lead, assessment } = approval.review;
  const copy = approvalCopy[locale];
  const busy = state.status === "working" || state.status === "done";
  const commentId = `comment-${approval.id}`;
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const original: ApprovalDraft = { subject: approval.review.email.subject ?? "", body: approval.review.email.body ?? "" };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ApprovalDraft>(original);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const edited = draft.subject !== original.subject || draft.body !== original.body;
  const { ref: openRunRef, ...openRunHandlers } = useIconHover();
  const { ref: approveRef, ...approveHandlers } = useIconHover();
  const { ref: rejectRef, ...rejectHandlers } = useIconHover();

  const decide = (decision: "approve" | "reject") => {
    if (busy) {
      return;
    }
    setProblem(undefined);
    submitApprovalDecision({
      decision,
      comment,
      draft,
      original,
      locale,
      onDecide,
      onInvalid: (message) => setProblem(message),
      focusNote: () => noteRef.current?.focus()
    });
  };

  return (
    <article className="card" aria-labelledby={`title-${approval.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
        <div className="min-w-0">
          <h2 id={`title-${approval.id}`} className="truncate text-base font-bold text-[var(--ink)]">
            {approval.review.email.subject ?? approval.nodeId}
          </h2>
          <p className="mt-1 font-mono text-xs text-[var(--mute)]">
            {labels.requestedAt}: {formatDateTime(approval.requestedAt, locale)} · {approval.workflowRunId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={approvalStatusTone[approval.status]}>{approval.status}</StatusPill>
          <Link
            {...openRunHandlers}
            href={`/runs/${approval.workflowRunId}?lang=${locale}`}
             className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--ink)]"
          >
            <span aria-hidden="true" inert className="inline-flex shrink-0">
              <EyeIcon ref={openRunRef} size={16} strokeWidth={1.75} />
            </span>
            {labels.openRun}
          </Link>
        </div>
      </header>

      <div className="grid gap-4 px-4 py-4 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="space-y-3">
          <div>
            <h3 className="mono-label">{labels.lead}</h3>
            <dl className="mt-1 space-y-1">
              {Object.entries(lead)
                .filter(([, value]) => value !== undefined && value !== null && value !== "")
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[var(--mute)]">{key}</dt>
                    <dd className="min-w-0 break-words text-[var(--ink)]">{String(value)}</dd>
                  </div>
                ))}
            </dl>
          </div>
          <div>
            <h3 className="mono-label">{labels.assessment}</h3>
            <dl className="mt-1 space-y-1">
              <Row label={labels.score} value={assessment.leadScore !== undefined ? String(assessment.leadScore) : "-"} />
              <Row label={labels.category} value={assessment.category ?? "-"} />
              <Row label={labels.summary} value={assessment.summary ?? "-"} />
              <Row label={labels.recommended} value={assessment.recommendedAction ?? "-"} />
            </dl>
          </div>
        </section>

        <section className="space-y-3">
          <ApprovalDraftPanel
            approval={approval}
            labels={labels}
            locale={locale}
            editing={editing}
            draft={draft}
            edited={edited}
            onToggle={() => setEditing((value) => !value)}
            onChange={(value) => {
              setDraft(value);
              setProblem(undefined);
            }}
            onUndo={() => {
              setDraft(original);
              setProblem(undefined);
            }}
          />

          {approval.status === "WAITING_APPROVAL" ? (
            <div className="space-y-2">
              <label htmlFor={commentId} className="block text-xs font-semibold text-[var(--mute)]">
                {copy.note}
              </label>
              <textarea
                id={commentId}
                ref={noteRef}
                value={comment}
                maxLength={2000}
                rows={2}
                disabled={busy}
                onChange={(event) => {
                  setProblem(undefined);
                  onCommentChange(event.target.value);
                }}
                className="field w-full rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  {...approveHandlers}
                  disabled={busy}
                  onClick={() => decide("approve")}
                   className="btn btn-primary inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:bg-[var(--surface-soft)] disabled:text-[var(--mute)]"
                >
                  <span aria-hidden="true" inert className="inline-flex shrink-0">
                    <SendIcon ref={approveRef} size={16} strokeWidth={1.75} />
                  </span>
                  {labels.approve}
                </button>
                <button
                  type="button"
                  {...rejectHandlers}
                  disabled={busy}
                  onClick={() => decide("reject")}
                   className="btn btn-secondary inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--danger-ink)] disabled:border-[var(--hairline)] disabled:text-[var(--mute)]"
                >
                  <span aria-hidden="true" inert className="inline-flex shrink-0">
                    <XIcon ref={rejectRef} size={16} strokeWidth={1.75} />
                  </span>
                  {labels.reject}
                </button>
                {state.status === "working" ? <span className="font-mono text-xs text-[var(--mute)]">[..] {labels.working}</span> : null}
              </div>
            </div>
          ) : null}

          {problem ? (
             <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger-ink)]">
              ⚠ {problem}
            </p>
          ) : null}

          {state.message ? (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={
                state.status === "error"
                  ? "rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[var(--danger-ink)]"
                  : "rounded-xl border border-[var(--success)] bg-[var(--success-soft)] px-3 py-2 text-[var(--success)]"
              }
            >
              {state.status === "error" ? "⚠ " : ""}
              {state.message}
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}

/** The outcome line that replaces a decided card for a few seconds. */
export function ApprovalSuccessLine({ message, runId, locale }: { message: string; runId: string; locale: Locale }) {
  const { ref: openRunRef, ...openRunHandlers } = useIconHover();

  return (
    <p role="status" className="rounded-[var(--radius-control)] border border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-3 font-mono text-sm text-[var(--ink)]">
      ✓ {message} ·{" "}
      <Link
        {...openRunHandlers}
        href={`/runs/${runId}?lang=${locale}`}
        className="inline-flex items-center gap-1.5 font-semibold underline"
      >
        <span aria-hidden="true" inert className="inline-flex shrink-0">
          <EyeIcon ref={openRunRef} size={16} strokeWidth={1.75} />
        </span>
        {approvalCopy[locale].openRun}
      </Link>
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-[var(--mute)]">{label}</dt>
      <dd className="min-w-0 break-words text-[var(--ink)]">{value}</dd>
    </div>
  );
}
