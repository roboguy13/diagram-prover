// Take a forest with edges going in arbitrary directions and convert it to a forest with edges going away from the root

import { Edge, getNeighbors } from "./SpanningForest";

export function buildRootedHierarchy<V>(roots: V[], adjacencyList: Edge<V>[]): Edge<V>[] {
  const visited = new Set<V>();
  const hierarchyEdges: Edge<V>[] = [];

  function dfs(vertex: V) {
    visited.add(vertex);

    const neighbors = getNeighbors(adjacencyList, vertex);

    for (const [neighbor, _edge] of neighbors) {
      if (!visited.has(neighbor)) {
        hierarchyEdges.push({ source: vertex, target: neighbor });
        dfs(neighbor);
      }
    }
  }

  for (const root of roots) {
    if (!visited.has(root)) {
      dfs(root);
    }
  }

  return hierarchyEdges;
}
