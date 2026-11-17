"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SalesTaskView } from "@agentops/shared";
import { DURATION, EASE_OUT, useIconHover } from "../../components/motion";
import CheckedIcon from "../../icons/checked-icon";
import { apiUrl, readError } from "../../lib/api";
import { getWorkspaceCookie } from "../auth/use-active-workspace";
import type { Locale } from "../../lib/i18n";
import { formatDateTime } from "../../lib/status";

type SalesTaskLabels = {
  salesTasks: string;
  noTasks: string;
  due: string;
  more: string;
};

type SalesTaskItem = SalesTaskView & {
  status?: string;
  overdue?: boolean;
};

const DEFAULT_LIMIT = 10;

const overdueCopy: Record<Locale, string> = {
  vi: "quá hạn",
  en: "overdue"
};

function isDone(task: SalesTaskItem): boolean {
  return String(task.status ?? "").toUpperCase() === "DONE";
}

export function isSalesTaskDone(task: SalesTaskItem): boolean {
  return isDone(task);
}

export function isSalesTaskOverdue(task: SalesTaskItem, now: number = Date.now()): boolean {
  if (isDone(task)) return false;
  if (typeof task.overdue === "boolean") return task.overdue;
  if (task.dueAt) {
    const due = new Date(task.dueAt).getTime();
    if (Number.isFinite(due)) return due < now;
  }
  return false;
}

export function nextSalesTaskStatus(status: unknown): "OPEN" | "DONE" {
  return String(status ?? "").toUpperCase() === "DONE" ? "OPEN" : "DONE";
}

export function sortSalesTasks<T extends SalesTaskItem>(tasks: T[]): T[] {
  const open = tasks.filter((task) => !isDone(task));
  const done = tasks.filter((task) => isDone(task));
  return [...open, ...done];
}

export async function updateSalesTask(
  id: string,
  status: "OPEN" | "DONE",
  workspaceId?: string
): Promise<SalesTaskItem> {
  const ws = workspaceId ?? getWorkspaceCookie();
  const query = ws ? `?workspaceId=${encodeURIComponent(ws)}` : "";
  const response = await fetch(`${apiUrl}/dashboard/sales-tasks/${encodeURIComponent(id)}${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    throw await readError(response);
  }
  const body = (await response.json()) as unknown;
  return (body && typeof body === "object" ? body : { id, status }) as SalesTaskItem;
}

export const patchSalesTask = updateSalesTask;
export const patchSalesTaskStatus = updateSalesTask;
export const setSalesTaskStatus = updateSalesTask;
export const updateSalesTaskStatus = updateSalesTask;
export default SalesTaskList;
export async function toggleSalesTask(
  idOrTask: string | { id: string; status?: unknown },
  currentStatus?: unknown,
  workspaceId?: string
): Promise<SalesTaskItem> {
  const id = typeof idOrTask === "string" ? idOrTask : idOrTask.id;
  const status = typeof idOrTask === "string" ? currentStatus : (currentStatus ?? idOrTask.status);
  return updateSalesTask(id, nextSalesTaskStatus(status), workspaceId);
}

function moreLabel(more: string, hidden: number) {
  return more.replace("{n}", String(hidden));
}

/** Checkbox that plays the checked-icon draw when a task is ticked. */
function TaskTick({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  const { ref: iconRef, onMouseEnter, onMouseLeave, onFocus, onBlur } = useIconHover();
  const previous = useRef(done);

  useEffect(() => {
    if (done && !previous.current) {
      iconRef.current?.startAnimation();
    }
    previous.current = done;
  }, [done, iconRef]);

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border align-middle transition-colors duration-200 ${done ? "border-transparent bg-[var(--accent)] text-white" : "border-[var(--hairline-strong)] bg-white text-transparent hover:border-[var(--accent)]"}`}
      aria-pressed={done}
      aria-label={done ? "mark open" : "mark done"}
    >
      {done ? (
        <>
          <CheckedIcon ref={iconRef} size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">done</span>
        </>
      ) : (
        <span aria-hidden="true" className="h-2 w-2 rounded-sm" />
      )}
    </button>
  );
}

/** Title with a strike-through line that grows left to right when the task is done. */
function TaskTitle({ title, done }: { title: string; done: boolean }) {
  const reduce = useReducedMotion() ?? false;

  return (
    <span className="relative inline-block">
      <span className={done ? "text-[var(--mute)]" : undefined}>{title}</span>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left bg-current"
        initial={false}
        animate={{ scaleX: done ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT }}
      />
    </span>
  );
}

export function SalesTaskList({
  tasks,
  labels,
  locale,
  limit = DEFAULT_LIMIT,
  workspaceId: propWorkspaceId
}: {
  tasks: SalesTaskItem[];
  labels: SalesTaskLabels;
  locale: Locale;
  limit?: number;
  workspaceId?: string;
}) {
  const workspaceId = propWorkspaceId ?? getWorkspaceCookie();
  const [items, setItems] = useState<SalesTaskItem[]>(() => sortSalesTasks(tasks));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    setItems(sortSalesTasks(tasks));
  }, [tasks]);

  const sorted = sortSalesTasks(items);
  const visible = sorted.slice(0, limit);
  const hidden = sorted.length - visible.length;

  const toggle = useCallback(
    async (task: SalesTaskItem) => {
      const currentStatus = String(task.status ?? "OPEN").toUpperCase();
      const next = nextSalesTaskStatus(currentStatus);
      setItems((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[task.id];
        return nextErrors;
      });
      try {
        const updated = await updateSalesTask(task.id, next, workspaceId);
        setItems((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
      } catch {
        setItems((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: currentStatus } : t)));
        setErrors((prev) => ({ ...prev, [task.id]: "⚠" }));
      }
    },
    [workspaceId]
  );

  return (
    <div className="card flex h-full min-w-0 flex-col">
      <div className="border-b border-[var(--hairline)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--ink)]">{labels.salesTasks}</h2>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--mute)]">{labels.noTasks}</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--hairline)]">
            {visible.map((task) => {
              const done = isDone(task);
              const overdue = isSalesTaskOverdue(task);
              return (
                <motion.li
                  key={task.id}
                  layout={!reduce}
                  transition={{ layout: { duration: DURATION.base, ease: EASE_OUT } }}
                  className={`px-4 py-3 text-sm ${done ? "text-[var(--mute)]" : ""}`}
                >
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <TaskTick done={done} onToggle={() => void toggle(task)} />
                    <TaskTitle title={task.title} done={done} />
                  </p>
                  <p className="text-[var(--body)]">{task.body}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--mute)]">
                    {task.dueAt ? `${labels.due}: ${formatDateTime(task.dueAt, locale)}` : null}
                    {overdue ? (
                      <>
                        {" "}
                        <span className="status-pill is-danger">
                          {overdueCopy[locale]}
                        </span>
                      </>
                    ) : null}
                    {task.workflowRunId ? (
                      <>
                        {" · "}
                        <Link href={`/runs/${task.workflowRunId}?lang=${locale}`} className="underline underline-offset-4">
                          {task.workflowRunId.slice(0, 16)}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {errors[task.id] ? (
                    <p role="alert" className="mt-1 font-mono text-xs text-[var(--danger-ink)]">
                      {errors[task.id]}
                    </p>
                  ) : null}
                </motion.li>
              );
            })}
          </ul>
          {hidden > 0 ? (
            <p className="border-t border-[var(--hairline)] px-4 py-3 text-sm text-[var(--mute)]">+ {moreLabel(labels.more, hidden)}</p>
          ) : null}
        </>
      )}
    </div>
  );
}