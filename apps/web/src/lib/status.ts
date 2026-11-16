import type { HumanApprovalStatus, WorkflowRunStatus, WorkflowStepStatus } from "@agentops/shared";
import type { StatusPillTone } from "../components/status-pill";

export const runStatusTone: Record<WorkflowRunStatus, StatusPillTone> = {
  PENDING: "warning",
  RUNNING: "info",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral"
};

export const stepStatusTone: Record<WorkflowStepStatus, StatusPillTone> = {
  PENDING: "neutral",
  RUNNING: "info",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  SKIPPED: "neutral"
};

export const approvalStatusTone: Record<HumanApprovalStatus, StatusPillTone> = {
  WAITING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral"
};

export function formatDuration(ms: number | undefined) {
  if (ms === undefined) return undefined;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatDateTime(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "medium" }).format(
    new Date(value)
  );
}
