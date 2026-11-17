"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sampleLeadWorkflowDefinition, validateWorkflowDefinition, type WorkflowDefinition } from "@agentops/shared";
import { DURATION, EASE_OUT, Reveal, useIconHover } from "../../components/motion";
import EyeIcon from "../../icons/eye-icon";
import PlayerIcon from "../../icons/player-icon";
import SparklesIcon from "../../icons/sparkles-icon";
import TrashIcon from "../../icons/trash-icon";
import UploadIcon from "../../icons/upload-icon";
import { ApiError, clientApiPost, type WorkflowView } from "../../lib/api";
import { useActiveWorkspace } from "../auth/use-active-workspace";
import type { Locale } from "../../lib/i18n";
import { deleteWorkflow, publishWorkflow, runWorkflow } from "./workflow-client";

/** Sample lead sent by the Run button (same shape as the website form webhook). */
export const sampleLeadInput = {
  name: "Anna Nguyen",
  company: "Shop ABC",
  email: "anna@shopabc.vn",
  message: "Chúng tôi cần tự động hóa việc trả lời khách hàng qua chat và theo dõi đơn hàng.",
  source: "website_form"
};

type ActionState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

type WorkflowActionLabels = {
  publish: string;
  publishing: string;
  published: string;
  run: string;
  running: string;
  builder: string;
};

const defaultLabels: WorkflowActionLabels = {
  publish: "Publish",
  publishing: "Publishing",
  published: "Published",
  run: "Run",
  running: "Running",
  builder: "Builder"
};

function IconSlot({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" inert className="inline-flex shrink-0">
      {children}
    </span>
  );
}

type WorkflowActionCopy = {
  runCreated: string;
  viewRun: string;
  publishFirst: string;
  delete: string;
  confirmDelete: string;
  deleting: string;
  requiresAdmin: string;
  runFailed: string;
  publishFailed: string;
  deleteFailed: string;
};

const actionCopy: Record<Locale, WorkflowActionCopy> = {
  vi: {
    runCreated: "Đã tạo run",
    viewRun: "Xem run",
    publishFirst: "Publish trước khi chạy",
    delete: "Xóa",
    confirmDelete: "Xác nhận xóa?",
    deleting: "Đang xóa",
    requiresAdmin: "Cần quyền ADMIN",
    runFailed: "Không chạy được workflow",
    publishFailed: "Không publish được workflow",
    deleteFailed: "Không xóa được workflow"
  },
  en: {
    runCreated: "Run created",
    viewRun: "View run",
    publishFirst: "Publish before running",
    delete: "Delete",
    confirmDelete: "Confirm delete?",
    deleting: "Deleting",
    requiresAdmin: "Requires ADMIN",
    runFailed: "Could not run the workflow",
    publishFailed: "Could not publish the workflow",
    deleteFailed: "Could not delete the workflow"
  }
};

export type RunButtonState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; runId: string }
  | { status: "error"; message: string };

export type DeleteButtonPhase = "idle" | "confirming" | "deleting";

/** Message shown on its own line below the card, never inside the button row. */
export type WorkflowCardMessage = {
  tone: "success" | "error" | "warning";
  text: string;
  runId?: string;
};

export const deleteConfirmMs = 4000;

/** First click arms the confirmation, the second one deletes. */
export function deleteClickAction(phase: DeleteButtonPhase): "confirm" | "delete" | "ignore" {
  if (phase === "idle") return "confirm";
  if (phase === "confirming") return "delete";
  return "ignore";
}

export function shortRunId(runId: string): string {
  return runId.slice(0, 12);
}

export function formatWorkflowError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const details = formatErrorDetails(error.details);
    return details ? `${error.message} (${details})` : error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatErrorDetails(details: unknown): string | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const entries = Object.entries(details as Record<string, unknown>).filter(
    ([, value]) => typeof value === "string" && value.length > 0
  );
  return entries.length ? entries.map(([field, value]) => `${field}: ${String(value)}`).join("; ") : undefined;
}

/** The run button only: it stays a plain child of the button row so every button keeps the same height. */
export function RunWorkflowControl({
  runLabel,
  runningLabel,
  state,
  disabled = false,
  hint,
  onRun
}: {
  runLabel: string;
  runningLabel: string;
  state: RunButtonState;
  disabled?: boolean;
  hint?: string;
  onRun: () => void;
}) {
  const { ref, ...iconHandlers } = useIconHover();

  return (
    <button
      type="button"
      {...iconHandlers}
      onClick={onRun}
      disabled={disabled || state.status === "loading"}
      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors duration-200 disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
      title={disabled ? hint : undefined}
    >
      <IconSlot>
        <PlayerIcon ref={ref} size={16} strokeWidth={1.75} />
      </IconSlot>
      {state.status === "loading" ? runningLabel : runLabel}
    </button>
  );
}

/** Outcome line of a card action. It is rendered below the card, as a sibling of the button row. */
export function WorkflowStatusLine({ locale, message }: { locale: Locale; message?: WorkflowCardMessage }) {
  const { ref, ...iconHandlers } = useIconHover();

  if (!message) return null;
  const copy = actionCopy[locale];

  if (message.tone === "success" && message.runId) {
    return (
      <Reveal>
        <p role="status" className="mt-2 font-mono text-xs text-[var(--success)]">
          ✓ {message.text} {shortRunId(message.runId)} ·{" "}
          <Link
            {...iconHandlers}
            href={`/runs/${message.runId}?lang=${locale}`}
            className="inline-flex items-center gap-1.5 font-semibold underline"
          >
            <IconSlot>
              <EyeIcon ref={ref} size={16} strokeWidth={1.75} />
            </IconSlot>
            {copy.viewRun} →
          </Link>
        </p>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <p
        role={message.tone === "error" ? "alert" : "status"}
        className={
          message.tone === "error"
            ? "mt-2 font-mono text-xs text-[var(--danger-ink)]"
            : "mt-2 font-mono text-xs text-[var(--warning-ink)]"
        }
      >
        ⚠ {message.text}
      </p>
    </Reveal>
  );
}

export function RunWorkflowButton({
  workflowId,
  labels = defaultLabels,
  locale = "vi",
  status,
  currentVersionId,
  onMessage
}: {
  workflowId: string;
  labels?: Partial<WorkflowActionLabels>;
  locale?: Locale;
  status?: WorkflowView["status"];
  currentVersionId?: string;
  /** Reports the outcome so the card can show it below the button row. */
  onMessage?: (message: WorkflowCardMessage) => void;
}) {
  const copy = { ...defaultLabels, ...labels };
  const strings = actionCopy[locale];
  const [state, setState] = useState<RunButtonState>({ status: "idle" });
  const notPublished = status === "DRAFT" && (!currentVersionId || currentVersionId === "draft");

  async function run() {
    if (notPublished) return;
    setState({ status: "loading" });
    try {
      const run = await runWorkflow(workflowId, sampleLeadInput);
      setState({ status: "success", runId: run.id });
      onMessage?.({ tone: "success", text: strings.runCreated, runId: run.id });
    } catch (error) {
      const message = formatWorkflowError(error, strings.runFailed);
      setState({ status: "error", message });
      onMessage?.({ tone: "error", text: message });
    }
  }

  return (
    <RunWorkflowControl
      runLabel={copy.run}
      runningLabel={copy.running}
      state={state}
      disabled={notPublished}
      hint={notPublished ? strings.publishFirst : undefined}
      onRun={run}
    />
  );
}

export function PublishWorkflowButton({
  workflowId,
  definition,
  labels = defaultLabels,
  invalidMessage = "Fix the validation issues before publishing.",
  locale = "vi",
  onMessage
}: {
  workflowId: string;
  /** When given, publishing is blocked client-side while the graph has validation issues. */
  definition?: WorkflowDefinition;
  labels?: Partial<WorkflowActionLabels>;
  invalidMessage?: string;
  locale?: Locale;
  /** Reports the outcome so the card can show it below the button row. */
  onMessage?: (message: WorkflowCardMessage) => void;
}) {
  const router = useRouter();
  const copy = { ...defaultLabels, ...labels };
  const { ref, ...iconHandlers } = useIconHover();
  const [state, setState] = useState<ActionState>({ status: "idle" });
  const issues = definition ? validateWorkflowDefinition(definition) : [];

  if (issues.length > 0) {
    return (
      <button
        type="button"
        {...iconHandlers}
        disabled
        aria-describedby={`publish-blocked-${workflowId}`}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 text-sm font-semibold text-[var(--mute)] transition-colors duration-200"
        title={invalidMessage}
      >
        <IconSlot>
          <UploadIcon ref={ref} size={16} strokeWidth={1.75} />
        </IconSlot>
        {copy.publish}
        <span id={`publish-blocked-${workflowId}`} className="sr-only">
          {invalidMessage}
        </span>
      </button>
    );
  }

  async function publish() {
    setState({ status: "loading", message: "publishing" });
    try {
      await publishWorkflow(workflowId);
      setState({ status: "success", message: "active" });
      router.refresh();
    } catch (error) {
      const message = formatWorkflowError(error, actionCopy[locale].publishFailed);
      setState({ status: "error", message });
      onMessage?.({ tone: "error", text: message });
    }
  }

  return (
    <button
      type="button"
      {...iconHandlers}
      onClick={publish}
      disabled={state.status === "loading"}
      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-white px-3 text-sm font-semibold text-[var(--ink)] transition-colors duration-200 disabled:border-[var(--hairline)] disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
    >
      <IconSlot>
        <UploadIcon ref={ref} size={16} strokeWidth={1.75} />
      </IconSlot>
      {state.status === "loading" ? copy.publishing : state.status === "success" ? copy.published : copy.publish}
    </button>
  );
}

export function DeleteWorkflowControl({
  phase,
  labels,
  onDelete
}: {
  phase: DeleteButtonPhase;
  labels: Pick<WorkflowActionCopy, "delete" | "confirmDelete" | "deleting">;
  onDelete: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const { ref, ...iconHandlers } = useIconHover();
  const label = phase === "confirming" ? labels.confirmDelete : phase === "deleting" ? labels.deleting : labels.delete;

  return (
    <button
      type="button"
      {...iconHandlers}
      onClick={onDelete}
      disabled={phase === "deleting"}
      className={
        phase === "confirming"
          ? "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 text-sm font-semibold text-[var(--danger-ink)] transition-colors duration-200 disabled:border-[var(--hairline)] disabled:text-[var(--mute)]"
          : "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-white px-3 text-sm font-semibold text-[var(--danger-ink)] transition-colors duration-200 disabled:border-[var(--hairline)] disabled:text-[var(--mute)]"
      }
    >
      <IconSlot>
        <TrashIcon ref={ref} size={16} strokeWidth={1.75} />
      </IconSlot>
      <span className="inline-grid">
        <AnimatePresence initial={false}>
          <motion.span
            key={phase}
            className="col-start-1 row-start-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? DURATION.reducedFade : DURATION.micro, ease: EASE_OUT }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

export function DeleteWorkflowButton({
  workflowId,
  locale = "vi",
  onMessage
}: {
  workflowId: string;
  locale?: Locale;
  /** Reports the outcome so the card can show it below the button row. */
  onMessage?: (message: WorkflowCardMessage) => void;
}) {
  const router = useRouter();
  const copy = actionCopy[locale];
  const [phase, setPhase] = useState<DeleteButtonPhase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (workflowId === "wf_lead_qualification") return null;

  async function remove() {
    setPhase("deleting");
    try {
      await deleteWorkflow(workflowId);
      setPhase("idle");
      router.refresh();
    } catch (error) {
      setPhase("idle");
      onMessage?.({
        tone: "error",
        text: error instanceof ApiError && error.status === 403 ? copy.requiresAdmin : formatWorkflowError(error, copy.deleteFailed)
      });
    }
  }

  function handleClick() {
    const action = deleteClickAction(phase);
    if (action === "ignore") return;

    if (action === "confirm") {
      setPhase("confirming");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setPhase("idle");
        timer.current = undefined;
      }, deleteConfirmMs);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    void remove();
  }

  return <DeleteWorkflowControl phase={phase} labels={copy} onDelete={handleClick} />;
}

/**
 * Workflow card: the content, the action buttons and the status line of the last action.
 * The buttons keep their own row (same height, no wrap on wide screens) and the status line is a
 * full-width sibling below them, so showing it never changes the button layout.
 */
export function WorkflowCard({
  workflowId,
  status,
  currentVersionId,
  definition,
  locale = "vi",
  labels,
  invalidMessage = "Fix the validation issues before publishing.",
  children
}: {
  workflowId: string;
  status: WorkflowView["status"];
  currentVersionId?: string;
  definition?: WorkflowDefinition;
  locale?: Locale;
  labels?: Partial<WorkflowActionLabels>;
  invalidMessage?: string;
  children?: ReactNode;
}) {
  const copy = { ...defaultLabels, ...labels };
  const strings = actionCopy[locale];
  const { ref, ...iconHandlers } = useIconHover();
  const [message, setMessage] = useState<WorkflowCardMessage | undefined>(undefined);
  const archived = status === "ARCHIVED";
  const notPublished = status === "DRAFT" && (!currentVersionId || currentVersionId === "draft");

  useEffect(() => {
    setMessage(undefined);
  }, [status]);

  return (
    <article className="bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {children}
        {archived ? (
          <span className="inline-flex min-h-9 items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--mute)]">
            ARCHIVED
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <Link
              {...iconHandlers}
              href={`/workflows/${workflowId}/builder?lang=${locale}`}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--hairline-strong)] bg-white px-3 text-sm font-semibold text-[var(--ink)] transition-colors duration-200"
            >
              <IconSlot>
                <EyeIcon ref={ref} size={16} strokeWidth={1.75} />
              </IconSlot>
              {copy.builder}
            </Link>
            <PublishWorkflowButton
              workflowId={workflowId}
              definition={definition}
              labels={labels}
              invalidMessage={invalidMessage}
              locale={locale}
              onMessage={setMessage}
            />
            <RunWorkflowButton
              workflowId={workflowId}
              labels={labels}
              locale={locale}
              status={status}
              currentVersionId={currentVersionId}
              onMessage={setMessage}
            />
            <DeleteWorkflowButton workflowId={workflowId} locale={locale} onMessage={setMessage} />
          </div>
        )}
      </div>
      <WorkflowStatusLine
        locale={locale}
        message={message ?? (notPublished ? { tone: "warning", text: strings.publishFirst } : undefined)}
      />
    </article>
  );
}

export function CreateFromTemplateButton({
  labels,
  locale,
  workspaceId: propWorkspaceId
}: {
  labels: { createFromTemplate: string; creating: string; createFailed: string };
  locale: Locale;
  workspaceId?: string;
}) {
  const router = useRouter();
  const { ref, ...iconHandlers } = useIconHover();
  const { active } = useActiveWorkspace();
  const workspaceId = propWorkspaceId ?? active?.id;
  const [state, setState] = useState<ActionState>({ status: "idle" });

  async function create() {
    if (!workspaceId) {
      setState({ status: "error", message: labels.createFailed });
      return;
    }
    setState({ status: "loading" });
    try {
      const workflow = await clientApiPost<WorkflowView>("/workflows", {
        workspaceId,
        name: `Lead qualification ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
        description: "Score a new lead, branch on intent, draft an email for approval, and create a sales task.",
        definition: sampleLeadWorkflowDefinition
      });
      router.push(`/workflows/${workflow.id}/builder?lang=${locale}`);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : labels.createFailed });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        {...iconHandlers}
        onClick={create}
        disabled={state.status === "loading"}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors duration-200 disabled:bg-[var(--surface-soft)] disabled:text-[var(--mute)]"
      >
        <IconSlot>
          <SparklesIcon ref={ref} size={16} strokeWidth={1.75} />
        </IconSlot>
        {state.status === "loading" ? labels.creating : labels.createFromTemplate}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="max-w-sm text-right text-xs text-[var(--danger-ink)]">
          ✕ {labels.createFailed}: {state.message}
        </p>
      ) : null}
    </div>
  );
}
