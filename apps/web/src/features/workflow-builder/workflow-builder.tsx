"use client";

import { useMemo } from "react";
import { Background, Controls, MarkerType, MiniMap, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { validateWorkflowDefinition, type WorkflowNodeType } from "@agentops/shared";
import { StatusPill } from "../../components/status-pill";
import { PublishWorkflowButton, RunWorkflowButton } from "../workflows/workflow-actions";
import type { ApiDataSource, WorkflowView } from "../../lib/api";
import type { Locale } from "../../lib/i18n";
import { useWorkflowBuilderStore } from "./workflow-builder-store";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left
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

const knownPositions: Record<string, { x: number; y: number }> = {
  "trigger-1": { x: 0, y: 130 },
  "ai-1": { x: 260, y: 80 },
  "condition-1": { x: 520, y: 130 },
  "webhook-1": { x: 780, y: 80 },
  "notification-1": { x: 780, y: 230 },
  "end-1": { x: 1040, y: 130 }
};

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
    run: "Run",
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

export function WorkflowBuilder({
  workflow,
  source,
  labels = defaultLabels,
  locale = "vi"
}: {
  workflow: WorkflowView;
  source: ApiDataSource;
  labels?: WorkflowBuilderLabels;
  locale?: Locale;
}) {
  const copy = labels;
  const { mode, selectedNodeId, setMode, selectNode } = useWorkflowBuilderStore();
  const validationIssues = useMemo(() => validateWorkflowDefinition(workflow.definition), [workflow.definition]);

  const nodes = useMemo<Node[]>(
    () =>
      workflow.definition.nodes.map((node, index) => ({
        id: node.id,
        type: "default",
        position: knownPositions[node.id] ?? { x: index * 260, y: index % 2 === 0 ? 120 : 240 },
        data: {
          label: <NodeLabel marker={nodeMarkers[node.type]} title={node.name} detail={node.type} />
        },
        ...nodeDefaults
      })),
    [workflow.definition.nodes]
  );

  const edges = useMemo<Edge[]>(
    () =>
      workflow.definition.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.condition,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#646262" },
        labelStyle: { fill: "#424245", fontWeight: 600 }
      })),
    [workflow.definition.edges]
  );

  const selectedDefinitionNode = workflow.definition.nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <section className="overflow-hidden border border-[#ded7cf] bg-white">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#ded7cf] px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-[#171412]">{workflow.name}</h1>
              <StatusPill tone={workflow.status === "ACTIVE" ? "success" : "warning"}>{workflow.status}</StatusPill>
              {source === "fallback" ? <StatusPill tone="warning">{copy.builder.fallback}</StatusPill> : null}
            </div>
            <p className="mt-1 text-sm text-[#5f5750]">{workflow.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[4px] border border-[#646262] bg-[#fdfcfc]">
              {(["design", "run-preview"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`min-h-9 px-3 text-sm font-medium ${
                    mode === item ? "bg-[#1d1a18] text-[#ffffff]" : "text-[#5f5750]"
                  }`}
                >
                  {item === "design" ? copy.builder.design : copy.builder.run}
                </button>
              ))}
            </div>
            <PublishWorkflowButton workflowId={workflow.id} labels={copy.common} />
            <RunWorkflowButton workflowId={workflow.id} labels={copy.common} locale={locale} />
          </div>
        </div>
        <div className="h-[620px] min-h-[520px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable
            onNodeClick={(_, node) => selectNode(node.id)}
            onPaneClick={() => selectNode(undefined)}
          >
            <Background color="#c7bdb3" />
            <Controls />
            <MiniMap nodeColor="#1d1a18" maskColor="rgba(251,250,247,0.72)" />
          </ReactFlow>
        </div>
      </section>

      <aside className="border border-[#ded7cf] bg-white">
        <div className="border-b border-[#ded7cf] px-4 py-3">
          <p className="text-xs font-semibold uppercase text-[#6b625a]">{copy.builder.inspector}</p>
          <h2 className="mt-1 text-lg font-bold text-[#171412]">{selectedDefinitionNode ? selectedDefinitionNode.name : copy.builder.workflow}</h2>
        </div>
        <div className="divide-y divide-[#eee7df] text-sm">
          <InspectorRow label={copy.builder.mode} value={mode === "design" ? copy.builder.draftDesign : copy.builder.runPreview} />
          <InspectorRow label={copy.builder.nodes} value={String(workflow.definition.nodes.length)} />
          <InspectorRow label={copy.builder.edges} value={String(workflow.definition.edges.length)} />
          <InspectorRow label={copy.builder.validation} value={validationIssues.length === 0 ? copy.builder.validGraph : `${validationIssues.length} ${copy.builder.issues}`} />
          <InspectorRow label={copy.builder.kafkaEvent} value="workflow-triggered" />
        </div>

        {selectedDefinitionNode ? (
          <div className="border-t border-[#ded7cf] px-4 py-3">
            <p className="text-xs font-semibold uppercase text-[#6b625a]">{copy.builder.nodeConfig}</p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-[4px] bg-[#f2eee9] p-3 text-xs leading-5 text-[#2f2a26]">
              {JSON.stringify(selectedDefinitionNode.config, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="border-t border-[#ded7cf] px-4 py-3">
            <p className="text-xs font-semibold uppercase text-[#6b625a]">{copy.builder.validationIssues}</p>
            <div className="mt-2 space-y-2 text-sm text-[#403a35]">
              {validationIssues.length > 0 ? (
                validationIssues.map((issue) => <p key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>[!] {issue.message}</p>)
              ) : (
                <p>[ok] {copy.builder.validMessage}</p>
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
    <div className="flex min-w-[178px] items-center gap-3 rounded-[4px] bg-white px-3 py-2">
      <span className="font-mono text-xs font-bold text-[#5f5750]">{marker}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#171412]">{title}</span>
        <span className="block truncate text-xs font-semibold text-[#5f5750]">{detail}</span>
      </span>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold uppercase text-[#6b625a]">{label}</p>
      <p className="mt-1 font-medium text-[#171412]">{value}</p>
    </div>
  );
}
