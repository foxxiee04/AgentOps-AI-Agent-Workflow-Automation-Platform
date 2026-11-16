export type WorkflowLayoutPoint = { x: number; y: number };

export const LAYER_HEIGHT = 130;
export const COLUMN_WIDTH = 260;

function isSideBranch(condition: unknown): boolean {
  const value = typeof condition === "string" ? condition.trim().toLowerCase() : "";
  return value === "else" || value === "default" || value === "rejected";
}

export function layoutWorkflow(nodes: any, edges: any): any {
  const nodeList = Array.isArray(nodes) ? nodes : Object.values(nodes ?? {});
  const edgeList = Array.isArray(edges) ? edges : Object.values(edges ?? {});

  const ids = nodeList.map((node: any) => String(node.id));
  const originalIndex = new Map(ids.map((id, index) => [id, index]));

  const adjacency = new Map(ids.map((id) => [id, [] as string[]]));
  const outgoingEdges = new Map<string, Array<{ target: string; condition?: unknown }>>();
  const indegree = new Map(ids.map((id) => [id, 0]));

  for (const edge of edgeList) {
    const source = String((edge as any).source);
    const target = String((edge as any).target);
    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!indegree.has(target)) indegree.set(target, 0);
    adjacency.get(source)!.push(target);
    if (!outgoingEdges.has(source)) outgoingEdges.set(source, []);
    outgoingEdges.get(source)!.push({ target, condition: (edge as any).condition });
    indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }
  for (const id of ids) {
    if (!indegree.has(id)) indegree.set(id, 0);
    if (!adjacency.has(id)) adjacency.set(id, []);
    if (!outgoingEdges.has(id)) outgoingEdges.set(id, []);
  }

  const layer = new Map(ids.map((id) => [id, 0]));
  const work = new Map(indegree);
  const queue = ids.filter((id) => (work.get(id) ?? 0) === 0);
  const visited: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.push(current);
    for (const target of adjacency.get(current) ?? []) {
      if ((layer.get(target) ?? 0) < (layer.get(current) ?? 0) + 1) {
        layer.set(target, (layer.get(current) ?? 0) + 1);
      }
      work.set(target, (work.get(target) ?? 0) - 1);
      if ((work.get(target) ?? 0) === 0) queue.push(target);
    }
  }

  for (const id of ids) {
    if (!visited.includes(id)) layer.set(id, 0);
  }

  const order = [...visited];
  for (const id of ids) {
    if (!order.includes(id)) order.push(id);
  }

  const column = new Map(ids.map((id) => [id, 0]));
  const assigned = new Set<string>();
  for (const id of ids) {
    if ((indegree.get(id) ?? 0) === 0) assigned.add(id);
  }

  for (const current of order) {
    const sourceColumn = column.get(current) ?? 0;
    if (!assigned.has(current)) {
      column.set(current, sourceColumn);
      assigned.add(current);
    }

    let branchOffset = 0;
    for (const edge of outgoingEdges.get(current) ?? []) {
      const isBranch = isSideBranch(edge.condition);
      const desiredColumn = isBranch ? sourceColumn + (branchOffset += 1) : sourceColumn;
      if (!assigned.has(edge.target)) {
        column.set(edge.target, desiredColumn);
        assigned.add(edge.target);
      } else {
        column.set(edge.target, Math.max(column.get(edge.target) ?? 0, desiredColumn));
      }
    }
  }

  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const currentLayer = layer.get(id) ?? 0;
    if (!groups.has(currentLayer)) groups.set(currentLayer, []);
    groups.get(currentLayer)!.push(id);
  }

  const positions: Record<string, WorkflowLayoutPoint> = {};
  for (const currentLayer of [...groups.keys()].sort((a, b) => a - b)) {
    const layerIds = [...(groups.get(currentLayer) ?? [])].sort((a, b) => {
      const byColumn = (column.get(a) ?? 0) - (column.get(b) ?? 0);
      return byColumn !== 0 ? byColumn : (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    });
    const usedColumns = new Set<number>();
    for (const id of layerIds) {
      let targetColumn = Math.max(0, column.get(id) ?? 0);
      while (usedColumns.has(targetColumn)) targetColumn += 1;
      usedColumns.add(targetColumn);
      positions[id] = { x: targetColumn * COLUMN_WIDTH, y: currentLayer * LAYER_HEIGHT };
    }
  }

  const layoutedNodes = nodeList.map((node: any) => ({
    ...node,
    position: positions[String(node.id)] ?? { x: 0, y: 0 }
  }));

  const result: any = { ...positions };
  Object.defineProperty(result, "positions", { value: positions, enumerable: false });
  Object.defineProperty(result, "nodes", { value: layoutedNodes, enumerable: false });
  Object.defineProperty(result, "layers", { value: layer, enumerable: false });
  return result;
}
