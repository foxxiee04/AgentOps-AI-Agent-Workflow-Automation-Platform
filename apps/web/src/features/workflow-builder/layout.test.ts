import { describe, expect, it } from "vitest";
import { sampleLeadWorkflowDefinition } from "@agentops/shared";
import { layoutWorkflow } from "./layout";

describe("layoutWorkflow", () => {
  const positions = layoutWorkflow(sampleLeadWorkflowDefinition.nodes, sampleLeadWorkflowDefinition.edges);

  it("puts the trigger in layer 0", () => {
    expect(positions["trigger-1"].y).toBe(0);
  });

  it("splits condition branches", () => {
    expect(positions["ai-2"]).not.toEqual(positions["end-1"]);
  });

  it("keeps the matching branch in the main column and offsets the else target to the right", () => {
    expect(positions["ai-2"].x).toBe(positions["trigger-1"].x);
    expect(positions["end-1"].x).toBeGreaterThan(positions["ai-2"].x);
  });

  it("offsets the rejected branch target to the right of the approved path", () => {
    expect(positions["notify-1"].x).toBeGreaterThan(positions["email-1"].x);
  });

  it("puts end-1 in the last layer", () => {
    const maxY = Math.max(...Object.values(positions).map((p: any) => p.y));
    expect(positions["end-1"].y).toBe(maxY);
  });

  it("has no overlapping positions in a layer", () => {
    const byLayer = new Map<number, Set<number>>();
    for (const pos of Object.values(positions) as any[]) {
      if (!byLayer.has(pos.y)) byLayer.set(pos.y, new Set());
      byLayer.get(pos.y)!.add(pos.x);
    }
    for (const [y, xs] of byLayer) {
      const count = Object.values(positions).filter((p: any) => p.y === y).length;
      expect(xs.size).toBe(count);
    }
  });
});