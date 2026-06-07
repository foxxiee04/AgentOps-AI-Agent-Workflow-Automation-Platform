"use client";

import Link from "next/link";
import { useState } from "react";
import { clientApiPost, type WorkflowRunView } from "../../lib/api";
import type { Locale } from "../../lib/i18n";

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
};

const defaultLabels: WorkflowActionLabels = {
  publish: "Publish",
  publishing: "Publishing",
  published: "Published",
  run: "Run",
  running: "Running"
};

export function RunWorkflowButton({
  workflowId,
  labels = defaultLabels,
  locale = "vi"
}: {
  workflowId: string;
  labels?: Partial<WorkflowActionLabels>;
  locale?: Locale;
}) {
  const copy = { ...defaultLabels, ...labels };
  const [state, setState] = useState<ActionState>({ status: "idle" });

  async function runWorkflow() {
    setState({ status: "loading", message: "running" });
    try {
      const result = await clientApiPost<{ run: WorkflowRunView }>(`/workflows/${workflowId}/run`, {
        triggerType: "manual",
        input: {
          leadName: "Demo lead",
          source: "frontend",
          intent: "urgent sales automation"
        }
      });
      setState({ status: "success", message: result.run.id });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "run failed" });
    }
  }

  if (state.status === "success" && state.message) {
    return (
      <Link
        href={`/runs/${state.message}?lang=${locale}`}
        className="inline-flex min-h-9 items-center rounded-[4px] bg-[#1d1a18] px-3 text-sm font-semibold text-[#ffffff]"
      >
        {copy.run} {state.message.slice(0, 12)}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={runWorkflow}
      disabled={state.status === "loading"}
      className="min-h-9 rounded-[4px] bg-[#1d1a18] px-3 text-sm font-semibold text-[#ffffff] disabled:bg-[#f2eee9] disabled:text-[#9a9898]"
      title={state.status === "error" ? state.message : undefined}
    >
      {state.status === "loading" ? copy.running : copy.run}
    </button>
  );
}

export function PublishWorkflowButton({ workflowId, labels = defaultLabels }: { workflowId: string; labels?: Partial<WorkflowActionLabels> }) {
  const copy = { ...defaultLabels, ...labels };
  const [state, setState] = useState<ActionState>({ status: "idle" });

  async function publishWorkflow() {
    setState({ status: "loading", message: "publishing" });
    try {
      await clientApiPost(`/workflows/${workflowId}/publish`, {});
      setState({ status: "success", message: "active" });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "publish failed" });
    }
  }

  return (
    <button
      type="button"
      onClick={publishWorkflow}
      disabled={state.status === "loading"}
      className="min-h-9 rounded-[4px] border border-[#8f8379] bg-white px-3 text-sm font-semibold text-[#1c1917] disabled:border-[#ded7cf] disabled:bg-[#f2eee9] disabled:text-[#9a9898]"
      title={state.status === "error" ? state.message : undefined}
    >
      {state.status === "loading" ? copy.publishing : state.status === "success" ? copy.published : copy.publish}
    </button>
  );
}
