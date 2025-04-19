import { GraphEdge, getNeighbors } from "./SpanningForest";

/**
 * Finds the root nodes in a potentially disconnected forest represented
 * by a map of parent IDs to lists of child IDs.
 * A root is defined as a node that exists in the set of all nodes
 * but does not appear as a child of any other node in the childrenMap.
 *
 * @param allNodeIds - An iterable (e.g., Set or Array) containing all node IDs in the graph.
 * @param childrenMap - A Map where keys are parent node IDs and values are arrays of their child node IDs.
 * @returns An array of node IDs identified as roots.
 */
export function findForestRoots<V>(
    allNodeIds: Iterable<V>,
    childrenMap: Map<V, V[]>
): V[] {
    const nodesSet = new Set(allNodeIds); // Efficient lookup for all nodes
    const childNodesSet = new Set<V>();

    // Collect all nodes that appear as children
    childrenMap.forEach((childrenList) => {
        childrenList.forEach(childId => childNodesSet.add(childId));
    });

    const roots: V[] = [];
    nodesSet.forEach(nodeId => {
        // If a node exists but is never listed as a child, it's a root
        if (!childNodesSet.has(nodeId)) {
            roots.push(nodeId);
        }
    });

    // Handle edge case: if the graph had only one node (or zero),
    // it might not appear in childrenMap values but should be considered a root.
    // The above logic handles this correctly as it iterates allNodeIds.
    // If roots is empty BUT nodesSet is not, it implies an issue (e.g., all nodes form a cycle not broken earlier)
    // or a single node graph where the single node should be the root.
    if (roots.length === 0 && nodesSet.size > 0) {
        // This might happen if the graph is just a single node, return it.
        // Or could indicate a cycle if spanning tree logic failed, handle appropriately.
        // For now, let's assume if nodes exist, at least one root must exist in a forest.
        // If roots is empty, maybe return the first node as a fallback? Or throw error?
        // Let's return the first node from the input set as a plausible fallback for single-node graphs.
         const firstNode = allNodeIds[Symbol.iterator]().next().value;
         if (firstNode !== undefined) {
             console.warn("findForestRoots: No nodes found without parents, returning the first node as root.");
             return [firstNode];
         } else {
             console.error("findForestRoots: No nodes and no roots found!");
             return [];
         }

    }

    return roots;
}

// Take a forest with edges going in arbitrary directions and convert it to a forest with edges going away from the root
export function buildRootedHierarchy<V>(roots: V[], adjacencyList: GraphEdge<V>[]): { visited: Set<V>, edges: GraphEdge<V>[] } {
  const visited = new Set<V>();
  const hierarchyEdges: GraphEdge<V>[] = [];

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

  return { visited, edges: hierarchyEdges };
}
