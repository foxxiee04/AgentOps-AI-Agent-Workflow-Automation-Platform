"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useQuery } from "@tanstack/react-query";
import { isRunActive, sampleLeadWorkflowDefinition, validateWorkflowDefinition, type WorkflowNodeType, type WorkflowStatus } from "@agentops/shared";
import { StatusPill } from "../../components/status-pill";
import { Reveal, useIconHover } from "../../components/motion";
import PlayerIcon from "../../icons/player-icon";
import UploadIcon from "../../icons/upload-icon";
import type { ApiDataSource, WorkflowView } from "../../lib/api";
import { formatDuration } from "../../lib/status";
import type { Locale } from "../../lib/i18n";
import { useWorkflowBuilderStore } from "./workflow-builder-store";
import { layoutWorkflow } from "./layout";
import { fetchRun, fetchRunSteps, publishWorkflow, runWorkflow } from "./builder-client";

const nodeDefaults = {
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top
};

const nodeMarkers: Record<WorkflowNodeType, string> = {
  TRIGGER: "[T]",
  AI_AGENT: "[AI]",
  CONDITION: "[?]",
  WEBHOOK: "[W]",
  HTTP_REQUEST: "[H]",
  EMAIL_MOCK: "[@]",
  DELAY: "[D]",
  HUMAN_APPROVAL: "[U]",
  NOTIFICATION: "[N]",
  END: "[X]"
};

export const knownPositions: Record<string, { x: number; y: number }> = layoutWorkflow(
  sampleLeadWorkflowDefinition.nodes,
  sampleLeadWorkflowDefinition.edges
);

export function edgeStyle(condition: string | undefined) {
  const normalized = condition?.trim().toLowerCase();
  const isMutedBranch = normalized === "else" || normalized === "default" || normalized === "rejected";
  return {
    label: condition?.trim() ? condition : undefined,
    style: { stroke: isMutedBranch ? "var(--mute)" : "var(--accent)", strokeDasharray: isMutedBranch ? "6 4" : undefined },
    labelStyle: { fill: "var(--ink)", fontWeight: 700, fontFamily: "ui-monospace, monospace" },
    labelBgStyle: { fill: "var(--surface-card)" }
  };
}

type WorkflowBuilderLabels = {
  builder: {
    fallback: string;
    design: string;
    run: string;
    inspector: string;
    workflow: string;
    mode: string;
    draftDesign: string;
    runPreview: string;
    nodes: string;
    edges: string;
    validation: string;
    validGraph: string;
    issues: string;
    kafkaEvent: string;
    nodeConfig: string;
    validationIssues: string;
    validMessage: string;
  };
  common: {
    publish: string;
    publishing: string;
    published: string;
    run: string;
    running: string;
  };
};

const defaultLabels: WorkflowBuilderLabels = {
  builder: {
    fallback: "fallback",
    design: "Design",
    run: "Run preview",
    inspector: "Inspector",
    workflow: "Workflow",
    mode: "Mode",
    draftDesign: "Draft design",
    runPreview: "Run preview",
    nodes: "Nodes",
    edges: "Edges",
    validation: "Validation",
    validGraph: "Valid graph",
    issues: "issue(s)",
    kafkaEvent: "Kafka event",
    nodeConfig: "Node config",
    validationIssues: "Validation issues",
    validMessage: "Trigger, end node, edge references, and required AI/tool config are valid."
  },
  common: {
    publish: "Publish",
    publishing: "Publishing",
    published: "Published",
    run: "Run",
    running: "Running"
  }
};

const strings = {
  vi: {
    previewEmpty: "Chưa có run - bấm Chạy để xem từng bước",
    runCreated: "✓ Đã tạo run",
    viewRun: "Xem run →",
    publishFirst: "Publish trước khi chạy"
  },
  en: {
    previewEmpty: "No run yet - press Run to follow the steps",
    runCreated: "✓ Created run",
    viewRun: "View run →",
    publishFirst: "Publish trước khi chạy"
  }
} as const;

function IconSlot({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      {children}
    </span>
  );
}

function stepColor(status: string): { border: string; dash?: boolean; muted?: boolean } {
  switch (status) {
    case "COMPLETED":
      return { border: "var(--success)" };
    case "RUNNING":
    case "WAITING_APPROVAL":
      return { border: "var(--warning)" };
    case "FAILED":
      return { border: "var(--danger)" };
    case "SKIPPED":
      return { border: "var(--ash)", dash: true, muted: true };
    default:
      return { border: "var(--hairline-strong)" };
  }
}

export function WorkflowBuilder({
  workflow,
  source,
  labels = defaultLabels,
  locale = "vi",
  invalidMessage
}: {
  workflow: WorkflowView;
  source: ApiDataSource;
  labels?: WorkflowBuilderLabels;
  locale?: Locale;
  invalidMessage?: string;
}) {
  const copy = labels;
  const t = strings[locale];
  const { mode, selectedNodeId, setMode, selectNode } = useWorkflowBuilderStore();
  const router = useRouter();
  const { ref: publishIconRef, ...publishIconHandlers } = useIconHover();
  const { ref: runIconRef, ...runIconHandlers } = useIconHover();

  const [status, setStatus] = useState<WorkflowStatus>(workflow.status);
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | undefined>(undefined);
  const [runSuccess, setRunSuccess] = useState<string | undefined>(undefined);
  const [publishState, setPublishState] = useState<{ status: "idle" | "loading" | "success" | "error"; message?: string }>({ status: "idle" });

  const validationIssues = useMemo(() => validateWorkflowDefinition(workflow.definition), [workflow.definition]);

  const runQuery = useQuery({
    queryKey: ["builder-run", runId],
    queryFn: () => fetchRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => (runId && isRunActive(query.state.data?.status ?? "") ? 2000 : false)
  });

  const stepsQuery = useQuery({
    queryKey: ["builder-run-steps", runId],
    queryFn: () => fetchRunSteps(runId!),
    enabled: !!runId,
    refetchInterval: () => (runId && isRunActive(runQuery.data?.status ?? "") ? 2000 : false)
  });

  const stepByNode = useMemo(() => {
    const map = new Map<string, any>();
    for (const step of stepsQuery.data?.steps ?? []) map.set(step.nodeId, step);
    return map;
  }, [stepsQuery.data]);

  const positions = useMemo(() => layoutWorkflow(workflow.definition.nodes, workflow.definition.edges), [workflow.definition.nodes, workflow.definition.edges]);

  const nodes = useMemo<Node[]>(
    () =>
      workflow.definition.nodes.map((node, index) => {
        const step = runId ? stepByNode.get(node.id) : undefined;
        const color = step ? stepColor(step.status) : undefined;
        const pos = positions?.[node.id] ?? positions?.positions?.[node.id] ?? { x: index * 260, y: index % 2 === 0 ? 120 : 240 };
        return {
          id: node.id,
          type: "default",
          position: pos,
          data: {
            label: <NodeLabel marker={nodeMarkers[node.type]} title={node.name} detail={node.type} />
          },
          ...nodeDefaults,
          style: {
            borderColor: color ? color.border : "var(--hairline)",
            transition: "border-color 0.25s ease, opacity 0.25s ease",
            ...(color
              ? {
                  borderWidth: 2,
                  borderStyle: color.dash ? "dashed" : "solid",
                  opacity: color.muted ? 0.6 : 1
                }
              : {})
          }
        };
      }),
    [workflow.definition.nodes, positions, stepByNode, runId]
  );

  const edges = useMemo<Edge[]>(
    () =>
      workflow.definition.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        pathOptions: { borderRadius: 6 },
        ...edgeStyle(edge.condition),
        markerEnd: { type: MarkerType.ArrowClosed }
      })),
    [workflow.definition.edges]
  );

  const selectedDefinitionNode = workflow.definition.nodes.find((node) => node.id === selectedNodeId);
  const selectedStep = selectedNodeId ? stepByNode.get(selectedNodeId) : undefined;

  async function handlePublish() {
    if (validationIssues.length > 0) return;
    setPublishState({ status: "loading" });
    try {
      await publishWorkflow(workflow.id);
      setStatus("ACTIVE");
      setPublishState({ status: "success" });
      router.refresh();
    } catch (error) {
      setPublishState({ status: "error", message: error instanceof Error ? error.message : "publish failed" });
    }
  }

  async function handleRun() {
    setRunError(undefined);
    if (status !== "ACTIVE") {
      setRunError(t.publishFirst);
      return;
    }
    setIsRunning(true);
    try {
      const result = await runWorkflow(workflow.id);
      setRunId(result.run.id);
      setRunSuccess(result.run.id);
      setMode("run-preview");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "run failed");
    } finally {
      setIsRunning(false);
    }
  }

  const canPublish = validationIssues.length === 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="card overflow-hidden">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-[var(--ink)]">{workflow.name}</h1>
              <StatusPill tone={status === "ACTIVE" ? "success" : "warning"}>{status}</StatusPill>
              {source === "fallback" ? <StatusPill tone="warning">{copy.builder.fallback}</StatusPill> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--mute)]">{workflow.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[var(--radius-control)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-0.5">
              {(["design", "run-preview"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                  className={`btn min-h-9 px-3 text-sm font-medium ${
                    mode === item ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--mute)]"
                  }`}
                >
                  {item === "design" ? copy.builder.design : copy.builder.run}
                </button>
              ))}
            </div>
            <button
              type="button"
              {...publishIconHandlers}
              onClick={handlePublish}
              disabled={!canPublish || publishState.status === "loading"}
              className="btn btn-secondary disabled:border-[var(--hairline)] disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
              title={!canPublish ? invalidMessage : publishState.status === "error" ? publishState.message : undefined}
            >
              <IconSlot>
                <UploadIcon ref={publishIconRef} size={16} strokeWidth={1.75} />
              </IconSlot>
              {publishState.status === "loading"
                ? copy.common.publishing
                : publishState.status === "success"
                  ? copy.common.published
                  : copy.common.publish}
            </button>
            <button
              type="button"
              {...runIconHandlers}
              onClick={handleRun}
              disabled={status !== "ACTIVE" || isRunning}
              className="btn btn-primary disabled:bg-[var(--surface-soft)] disabled:text-[var(--ash)]"
              title={status !== "ACTIVE" ? t.publishFirst : undefined}
            >
              <IconSlot>
                <PlayerIcon ref={runIconRef} size={16} strokeWidth={1.75} />
              </IconSlot>
              {isRunning ? copy.common.running : copy.common.run}
            </button>
            {status !== "ACTIVE" ? <span className="text-xs text-[var(--mute)]">{t.publishFirst}</span> : null}
          </div>
        </div>
        {runSuccess ? (
          <Reveal>
            <div className="border-b border-[var(--hairline)] px-4 py-2 text-sm">
              <span className="font-mono text-[var(--success)]">{t.runCreated} {runSuccess.slice(0, 12)}</span>
              <span className="mx-2 text-[var(--mute)]">·</span>
              <Link href={`/runs/${runSuccess}?lang=${locale}`} className="font-semibold text-[var(--accent)]">
                {t.viewRun}
              </Link>
            </div>
          </Reveal>
        ) : null}
        {runError ? (
          <Reveal>
            <p role="alert" className="border-b border-[var(--hairline)] bg-[var(--danger-soft)] px-4 py-2 font-mono text-xs text-[var(--danger-ink)]">
              ⚠ {runError}
            </p>
          </Reveal>
        ) : null}
        {publishState.status === "error" && publishState.message ? (
          <Reveal>
            <p role="alert" className="border-b border-[var(--hairline)] bg-[var(--danger-soft)] px-4 py-2 font-mono text-xs text-[var(--danger-ink)]">
              ⚠ {publishState.message}
            </p>
          </Reveal>
        ) : null}
        <div className="h-[620px] min-h-[520px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.6}
            onInit={(instance) => {
              requestAnimationFrame(() => instance.fitView({ padding: 0.2 }));
            }}
            nodesDraggable
            onNodeClick={(_, node) => selectNode(node.id)}
            onPaneClick={() => selectNode(undefined)}
          >
            <Background color="var(--hairline)" />
            <Controls />
          </ReactFlow>
        </div>
      </section>

      <aside className="card">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <p className="mono-label">{copy.builder.inspector}</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">{selectedDefinitionNode ? selectedDefinitionNode.name : copy.builder.workflow}</h2>
        </div>
        <div className="divide-y divide-[var(--hairline)] text-sm">
          <InspectorRow label={copy.builder.mode} value={mode === "design" ? copy.builder.draftDesign : copy.builder.runPreview} />
          <InspectorRow label={copy.builder.nodes} value={String(workflow.definition.nodes.length)} />
          <InspectorRow label={copy.builder.edges} value={String(workflow.definition.edges.length)} />
          <InspectorRow label={copy.builder.validation} value={validationIssues.length === 0 ? copy.builder.validGraph : `${validationIssues.length} ${copy.builder.issues}`} />
          <InspectorRow label={copy.builder.kafkaEvent} value="workflow-triggered" />
        </div>

        {mode === "run-preview" && !runId ? (
          <div className="border-t border-[var(--hairline)] px-4 py-3">
            <p className="font-mono text-sm text-[var(--mute)]">{t.previewEmpty}</p>
          </div>
        ) : null}

        {selectedDefinitionNode ? (
          <div className="border-t border-[var(--hairline)] px-4 py-3">
            {mode === "run-preview" && runId ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-[var(--mute)]">Step</p>
                <InspectorRow label="Status" value={selectedStep?.status ?? "PENDING"} />
                <InspectorRow label="Duration" value={formatDuration(selectedStep?.durationMs) ?? "-"} />
                <p className="text-xs font-semibold uppercase text-[var(--mute)]">Output</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--body)]">
                  {JSON.stringify(selectedStep?.output ?? null, null, 2)}
                </pre>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase text-[var(--mute)]">{copy.builder.nodeConfig}</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[var(--surface-soft)] p-3 text-xs leading-5 text-[var(--body)]">
                  {JSON.stringify(selectedDefinitionNode.config, null, 2)}
                </pre>
              </>
            )}
          </div>
        ) : (
          <div className="border-t border-[var(--hairline)] px-4 py-3">
            <p className="text-xs font-semibold uppercase text-[var(--mute)]">{copy.builder.validationIssues}</p>
            <div className="mt-2 space-y-2 text-sm text-[var(--body)]">
              {validationIssues.length > 0 ? (
                validationIssues.map((issue) => <p key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>⚠ {issue.message}</p>)
              ) : (
                <p>✓ {copy.builder.validMessage}</p>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function NodeLabel({ marker, title, detail }: { marker: string; title: string; detail: string }) {
  return (
    <div className="flex min-w-[178px] items-center gap-3 rounded-xl bg-[var(--surface-card)] px-3 py-2">
      <span className="font-mono text-xs font-bold text-[var(--mute)]">{marker}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[var(--ink)]">{title}</span>
        <span className="block truncate text-xs font-semibold text-[var(--mute)]">{detail}</span>
      </span>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold uppercase text-[var(--mute)]">{label}</p>
      <p className="mt-1 font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}
