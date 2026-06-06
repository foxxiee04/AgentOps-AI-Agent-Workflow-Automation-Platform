import { create } from "zustand";

export type BuilderMode = "design" | "run-preview";

type WorkflowBuilderState = {
  mode: BuilderMode;
  selectedNodeId?: string;
  setMode: (mode: BuilderMode) => void;
  selectNode: (nodeId?: string) => void;
};

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set) => ({
  mode: "design",
  selectedNodeId: undefined,
  setMode: (mode) => set({ mode }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId })
}));

