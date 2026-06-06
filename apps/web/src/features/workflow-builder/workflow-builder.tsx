"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";
import { Background, Controls, MarkerType, MiniMap, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { Bot, CheckCircle2, GitBranch, Play, Send, Webhook } from "lucide-react";
import { useWorkflowBuilderStore } from "./workflow-builder-store";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left
};

export function WorkflowBuilder() {
  const { mode, selectedNodeId, setMode, selectNode } = useWorkflowBuilderStore();
  const nodes = useMemo<Node[]>(
    () => [
      {
        id: "trigger-1",
        type: "default",
        position: { x: 0, y: 120 },
        data: { label: <NodeLabel icon={<Play />} title="Manual trigger" detail="Lead form payload" /> },
        ...nodeDefaults
      },
      {
        id: "ai-1",
        type: "default",
        position: { x: 260, y: 70 },
        data: { label: <NodeLabel icon={<Bot />} title="AI score lead" detail="Structured JSON" /> },
        ...nodeDefaults
      },
      {
        id: "condition-1",
        type: "default",
        position: { x: 520, y: 120 },
        data: { label: <NodeLabel icon={<GitBranch />} title="Score > 80" detail="Branch rule" /> },
        ...nodeDefaults
      },
      {
        id: "webhook-1",
        type: "default",
        position: { x: 780, y: 60 },
        data: { label: <NodeLabel icon={<Webhook />} title="Webhook mock" detail="POST /follow-up" /> },
        ...nodeDefaults
      },
      {
        id: "notification-1",
        type: "default",
        position: { x: 780, y: 210 },
        data: { label: <NodeLabel icon={<Send />} title="Create task" detail="Sales follow-up" /> },
        ...nodeDefaults
      },
      {
        id: "end-1",
        type: "default",
        position: { x: 1040, y: 135 },
        data: { label: <NodeLabel icon={<CheckCircle2 />} title="End" detail="Run complete" /> },
        ...nodeDefaults
      }
    ],
    []
  );

  const edges = useMemo<Edge[]>(
    () => [
      { id: "e1", source: "trigger-1", target: "ai-1", markerEnd: { type: MarkerType.ArrowClosed } },
      { id: "e2", source: "ai-1", target: "condition-1", markerEnd: { type: MarkerType.ArrowClosed } },
      {
        id: "e3",
        source: "condition-1",
        target: "webhook-1",
        label: "true",
        markerEnd: { type: MarkerType.ArrowClosed }
      },
      {
        id: "e4",
        source: "condition-1",
        target: "notification-1",
        label: "else",
        markerEnd: { type: MarkerType.ArrowClosed }
      },
      { id: "e5", source: "webhook-1", target: "end-1", markerEnd: { type: MarkerType.ArrowClosed } },
      { id: "e6", source: "notification-1", target: "end-1", markerEnd: { type: MarkerType.ArrowClosed } }
    ],
    []
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <section className="overflow-hidden rounded-lg border border-[#dbe5df] bg-white">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#dbe5df] px-4 py-3">
          <div>
            <h1 className="text-base font-black">Lead qualification builder</h1>
            <p className="text-sm text-[#64706d]">Manual trigger / AI scoring / branch / mock action</p>
          </div>
          <div className="flex rounded-md border border-[#dbe5df] bg-[#f7faf7] p-1">
            {(["design", "run-preview"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`h-8 rounded px-3 text-sm font-bold ${
                  mode === item ? "bg-white text-[#08785a] shadow-sm" : "text-[#64706d]"
                }`}
              >
                {item === "design" ? "Design" : "Run"}
              </button>
            ))}
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
            <Background color="#cfdad4" />
            <Controls />
            <MiniMap nodeColor="#0f9f75" maskColor="rgba(248,250,247,0.72)" />
          </ReactFlow>
        </div>
      </section>

      <aside className="rounded-lg border border-[#dbe5df] bg-white p-4">
        <p className="text-xs font-bold uppercase text-[#64706d]">Inspector</p>
        <h2 className="mt-2 text-lg font-black">{selectedNode ? selectedNode.id : "Workflow"}</h2>
        <div className="mt-4 space-y-3 text-sm text-[#4d5a57]">
          <InspectorRow label="Status" value={mode === "design" ? "Draft" : "Ready to run"} />
          <InspectorRow label="Validation" value="Trigger and end node present" />
          <InspectorRow label="Retry policy" value="3 attempts" />
          <InspectorRow label="AI output" value="JSON schema required" />
          <InspectorRow label="Kafka event" value="workflow-triggered" />
        </div>
      </aside>
    </div>
  );
}

function NodeLabel({ icon, title, detail }: { icon: ReactElement; title: string; detail: string }) {
  return (
    <div className="flex min-w-[170px] items-center gap-3 rounded-lg bg-white px-3 py-2">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-[#e5f6ef] text-[#08785a] [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-black text-[#18201f]">{title}</span>
        <span className="block text-xs font-semibold text-[#64706d]">{detail}</span>
      </span>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#f7faf7] p-3">
      <p className="text-xs font-bold uppercase text-[#64706d]">{label}</p>
      <p className="mt-1 font-semibold text-[#18201f]">{value}</p>
    </div>
  );
}
